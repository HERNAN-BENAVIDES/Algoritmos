// exportPdf.js — REEMPLAZO COMPLETO (modo “safe” sin rotation en addImage)

let libsLoading = null

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve()
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('No se pudo cargar ' + src))
        document.head.appendChild(s)
    })
}

export async function ensurePdfLibs() {
    if (window.jspdf && window.html2canvas) return
    if (libsLoading) return libsLoading
    libsLoading = (async () => {
        await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
        await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
        if (!window.jspdf || !window.html2canvas) throw new Error('Librerías PDF no disponibles')
    })()
    return libsLoading
}

async function captureElement(el, { scale = 2 } = {}) {
    await ensurePdfLibs()
    const { html2canvas } = window
    return html2canvas(el, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
    })
}

// --- util: rotar un canvas (grados CW) ---
function rotateCanvas(srcCanvas, degreesCW) {
    const rad = (degreesCW * Math.PI) / 180
    const dst = document.createElement('canvas')
    const s = Math.sin(rad), c = Math.cos(rad)
    // bounding box de la rotación (rectángulo circunscrito)
    const w = srcCanvas.width, h = srcCanvas.height
    const newW = Math.abs(w * c) + Math.abs(h * s)
    const newH = Math.abs(w * s) + Math.abs(h * c)
    dst.width = Math.round(newW)
    dst.height = Math.round(newH)
    const ctx = dst.getContext('2d')
    ctx.translate(dst.width / 2, dst.height / 2)
    ctx.rotate(rad)
    ctx.drawImage(srcCanvas, -w / 2, -h / 2)
    return dst
}

// --- util: paginar una imagen SIN usar rotation en addImage ---
async function addImagePaginatedNoRotation(pdf, canvas, { margin = 10, jpegQuality = 0.92 } = {}) {
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const usableW = pageW - margin * 2
    const usableH = pageH - margin * 2

    // Escalado para que la imagen quepa en ancho
    let drawW = usableW
    let drawH = (canvas.height * drawW) / canvas.width

    const toJPEG = (cnv) => cnv.toDataURL('image/jpeg', jpegQuality)

    if (drawH <= usableH) {
        const x = (pageW - drawW) / 2
        const y = (pageH - drawH) / 2
        pdf.addImage(toJPEG(canvas), 'JPEG', x, y, drawW, drawH, undefined, 'FAST')
        return
    }

    // Cortar “rebanadas” horizontales (alto en px equivalente al alto útil de la página)
    const slicePx = Math.floor((usableH * canvas.width) / drawW)
    const temp = document.createElement('canvas')
    temp.width = canvas.width
    temp.height = slicePx
    const tctx = temp.getContext('2d')

    let offset = 0
    let first = true
    while (offset < canvas.height) {
        const remaining = canvas.height - offset
        const h = Math.min(slicePx, remaining)
        tctx.clearRect(0, 0, temp.width, temp.height)
        tctx.drawImage(canvas, 0, offset, canvas.width, h, 0, 0, temp.width, h)

        const partHmm = (h * drawW) / canvas.width
        if (!first) pdf.addPage(undefined, pdf.internal.getCurrentPageInfo().pageContext.orientation || 'landscape')
        const x = (pageW - drawW) / 2
        const y = (pageH - partHmm) / 2
        pdf.addImage(toJPEG(temp), 'JPEG', x, y, drawW, partHmm, undefined, 'FAST')

        offset += h
        first = false
    }
}

export async function exportSingleElement(el, filename = 'visualizacion.pdf') {
    await ensurePdfLibs()
    const { jsPDF } = window.jspdf
    const pdf = new jsPDF('p', 'mm', 'a4')
    const canvas = await captureElement(el)
    const pageW = pdf.internal.pageSize.getWidth() - 10 * 2
    const pageH = pdf.internal.pageSize.getHeight() - 10 * 2
    let w = pageW
    let h = (canvas.height * w) / canvas.width
    if (h > pageH) { h = pageH; w = (canvas.width * h) / canvas.height }
    const x = (pdf.internal.pageSize.getWidth() - w) / 2
    const y = (pdf.internal.pageSize.getHeight() - h) / 2
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h, undefined, 'FAST')
    pdf.save(filename)
}

/**
 * Doble rotación “segura”:
 * 1) Rotamos el CONTENIDO 90° a la derecha (CW) en canvas.
 * 2) “Rotamos la HOJA 90° a la izquierda” simulándolo con otra rotación en canvas (-90°),
 *    para que el resultado final quede UPRIGHT, sin usar `rotation` en addImage.
 * 3) Insertamos en un PDF apaisado, con paginación si hace falta.
 * (Esto evita los PDF en blanco reportados cuando se usa `rotation` en addImage.)
 */
export async function exportElementDoubleRotated(el, filename = 'visualizacion_rotada.pdf') {
    await ensurePdfLibs()
    const { jsPDF } = window.jspdf
    if (!el) throw new Error('Elemento no provisto')

    // 1) Captura base
    const base = await captureElement(el, { scale: 2 })

    // 2) Rotar contenido 90° CW
    const cw = rotateCanvas(base, 90)

    // 3) “Rotar hoja 90° CCW” -> lo simulamos rotando el contenido -90°,
    //    resultando en una imagen UPRIGHT que se puede pegar sin `rotation`.
    //    (Sigue siendo doble rotación, pero toda realizada en canvas para evitar bugs.)
    const upright = rotateCanvas(cw, -90)

    // 4) PDF landscape y pegado sin rotation
    const pdf = new jsPDF('landscape', 'mm', 'a4')
    await addImagePaginatedNoRotation(pdf, upright, { margin: 8, jpegQuality: 0.92 })
    pdf.save(filename)
}



// Convierte un DataURL (PNG/JPEG) a PDF con la misma “doble rotación segura”
export async function exportImageUrlDoubleRotated(dataUrl, filename = 'grafico.pdf') {
    await ensurePdfLibs()
    const { jsPDF } = window.jspdf

    // Cargar imagen en <img> y pintar a canvas
    const img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.crossOrigin = 'anonymous'
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = dataUrl
    })

    const base = document.createElement('canvas')
    base.width = img.naturalWidth || img.width
    base.height = img.naturalHeight || img.height
    base.getContext('2d').drawImage(img, 0, 0)

    // Reutilizamos las utilidades ya definidas arriba
    const cw = rotateCanvas(base, 90)   // contenido 90° a la derecha
    const upright = rotateCanvas(cw, -90) // “rotar hoja a la izquierda” sin usar rotation en addImage

    const pdf = new jsPDF('landscape', 'mm', 'a4')
    await addImagePaginatedNoRotation(pdf, upright, { margin: 8, jpegQuality: 0.92 })
    pdf.save(filename)
}
