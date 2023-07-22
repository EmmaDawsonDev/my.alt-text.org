const CVS_PADDING = 0

const uploadWrapper = document.getElementById("upload-wrapper")
const upload = document.getElementById('upload');
const topUpload = document.getElementById('top-upload')
const extractBtn = document.getElementById("extract-btn")
const canvasWrapper = document.getElementById("cvs-wrapper")
const canvas = new fabric.Canvas("cvs", {
    uniformScaling: false
})

window.onresize = () => {
    if (canvas.backgroundImage) {
        MyAltTextOrg.currImage.scale = scaleCanvas(canvas.backgroundImage)
    }
}

canvas.selectionColor = 'transparent'
canvas.selectionBorderColor = "transparent"

const BACKSPACE_KEY = 8
//TODO: Move into general controls
document.body.addEventListener('keyup', (e) => {
    if (e.isComposing) {
        return
    }

    if (e.keyCode === BACKSPACE_KEY) {
        const active = canvas.getActiveObject()
        if (active) {
            canvas.remove(active)
        }
    }
})

document.onpaste = function (event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file') {
            loadFile(item.getAsFile())
        }
    }
};

upload.addEventListener('dragenter', () => {
    upload.parentNode.className = 'area dragging';
}, false);

upload.addEventListener('dragleave', () => {
    upload.parentNode.className = 'area';
}, false);

upload.addEventListener('dragdrop', () => {
    const file = upload.files[0]
    loadFile(file)
}, false);

upload.addEventListener('change', async () => {
    const file = upload.files[0]
    await loadFile(file)
}, false);

topUpload.addEventListener('change', async () => {
    const file = topUpload.files[0]
    await loadFile(file)
}, false);

async function loadFile(file) {
    const objUrl = URL.createObjectURL(file);
    if (MyAltTextOrg.c.discardCropsOnNewImg) {
        canvas.clear()
    }

    fabric.Image.fromURL(objUrl, async img => {
        uploadWrapper.style.display = "none"
        canvasWrapper.style.display = "flex"

        MyAltTextOrg.currImage = {
            hash: await hashImage(file),
            name: file.name,
            scale: scaleCanvas(img)
        }

        canvas.setBackgroundImage(img, null, {
            top: CVS_PADDING,
            left: CVS_PADDING
        })

        //TODO: don't let crops outside canvas
        // cropRect.on('moving', handleCropMoving)
        // cropRect.on('scaling', handleCropScaling)

        canvas.renderAll()
        updateDescriptionDisplay()

        closeImgBtn.disabled = false
        extractBtn.disabled = false
    });
}

function clearImage() {
    canvas.clear()
    uploadWrapper.style.display = "flex"
    canvasWrapper.style.display = "none"
    MyAltTextOrg.currImage = null
    closeImgBtn.disabled = true
    extractBtn.disabled = true
    updateDescriptionDisplay()
}

let primaryMouseButtonDown = false;
function setPrimaryButtonState(e) {
    const flags = e.buttons !== undefined ? e.buttons : e.which;
    primaryMouseButtonDown = (flags & 1) === 1;
}

document.addEventListener("mousedown", setPrimaryButtonState);
document.addEventListener("mousemove", setPrimaryButtonState);
document.addEventListener("mouseup", setPrimaryButtonState);


// canvas.on('mouse:move', handleMouseMove)
// canvas.on('mouse:up', handleMouseUp)
// canvas.on('mouse:down', handleMouseDown)
// canvas.on('mouse:over', handleMouseOver)
// canvas.on('mouse:out', handleMouseOut)

let currRect = null
let currRectStart = null
let lastPoint = null
let justEntered = false
function handleMouseDown(e) {
    console.log(`Down: ${JSON.stringify(e.pointer)}`)
    if (e.button !== 1 || isOverActiveObject(e.pointer) || currRect) {
        return
    }

    addRect(e.pointer)
}

function handleMouseMove(e) {
    // console.log(`Move: ${JSON.stringify(e.pointer)}`)
    if (e.pointer) {
        lastPoint = e.pointer
    }

    if (!primaryMouseButtonDown || !currRect) {
        return
    }

    renderRect(e.pointer)
}

function handleMouseUp(e) {
    console.log(`Up: ${JSON.stringify(e.pointer)}`)

    currRect = null
    currRectStart = null
}

function handleMouseOver(e) {
    console.log(`Over`)
    justEntered = true
}

function handleMouseOut(e) {
    console.log(`Out: ${JSON.stringify(lastPoint)}`)

    if (primaryMouseButtonDown && currRect) {
        renderRect(lastPoint)
    }
}

function addRect(pointer) {
    const cropRect = new fabric.Rect({
        left: pointer.x * MyAltTextOrg.currImage.scale,
        top: pointer.y * MyAltTextOrg.currImage.scale,
        width: 1,
        height: 1,
        fill: 'transparent',
        stroke: '#FF0000',
        strokeWidth: 3 / MyAltTextOrg.currImage.scale,
        strokeDashArray: [5 / MyAltTextOrg.currImage.scale, 3 / MyAltTextOrg.currImage.scale],
        strokeUniform: true,
        uniformScaling: false,
    })
    canvas.add(cropRect)
    currRect = cropRect
    currRectStart = {
        x: pointer.x,
        y: pointer.y
    }
}

function isOverActiveObject(pointer) {
    const active = canvas.getActiveObject()
    if (!active) {
        return
    }

    return pointer.x >= active.left && pointer.x <= (active.left + active.width) * active.scaleX
        && pointer.y >= active.top && pointer.y <= (active.top + active.height) * active.scaleY
}

function renderRect(pointer) {
    currRect.scale(1)
    currRect.left = Math.min(pointer.x, currRectStart.x) * MyAltTextOrg.currImage.scale
    currRect.top = Math.min(pointer.y, currRectStart.y) * MyAltTextOrg.currImage.scale
    currRect.width = (Math.max(pointer.x, currRectStart.x) - currRect.left) * MyAltTextOrg.currImage.scale
    currRect.height = (Math.max(pointer.y, currRectStart.y) - currRect.top) * MyAltTextOrg.currImage.scale
    canvas.renderAll()
}

function scaleCanvas(img) {
    if (!img) {
        return
    }

    const ratio = Math.min(
        Math.min(canvasWrapper.clientWidth / img.width, 1),
        Math.min(canvasWrapper.clientHeight / img.height, 1),
    );
    canvas.setZoom(ratio)
    canvas.setDimensions({
        width: img.width * ratio + CVS_PADDING * 2,
        height: img.height * ratio + CVS_PADDING * 2
    })
    canvas.renderAll()
    return ratio
}

function handleCropMoving() {
    const cropRect = canvas.getActiveObject()
    //TODO: Can't move to bottom or right sides
    if ((cropRect.left * MyAltTextOrg.currImage.scale) < 10) {
        cropRect.left = 10
    }

    if ((cropRect.left + cropRect.width * cropRect.scaleX) * MyAltTextOrg.currImage.scale > canvas.width - 20) {
        cropRect.left = canvas.width - 20 - cropRect.width * cropRect.scaleX
    }

    if ((cropRect.top * MyAltTextOrg.currImage.scale) < 10) {
        cropRect.top = 10
    }

    if ((cropRect.top + cropRect.height * cropRect.scaleY) * MyAltTextOrg.currImage.scale > canvas.height - 20) {
        cropRect.top = canvas.height - 20 - cropRect.height * cropRect.scaleY
    }
}

function handleCropScaling() {
    //TODO: Prevent scaling outside canvas
}

function crop() {
    canvas.setZoom(1)
    let crops = canvas.getActiveObject() ? [canvas.getActiveObject()] : canvas.getObjects("rect");
    if (crops.length > 0) {
        const result = []
        for (let crop of crops) {
            crop.opacity = 0
            const dataUrl = canvas.toDataURL({
                left: crop.left,
                top: crop.top,
                width: crop.width * crop.scaleX,
                height: crop.height * crop.scaleY
            })
            crop.opacity = 1
            result.push(dataUrl)
        }

        canvas.setZoom(MyAltTextOrg.currImage.scale)
        return result
    } else {
        canvas.setZoom(MyAltTextOrg.currImage.scale)
        return [canvas.toDataURL()]
    }
}
