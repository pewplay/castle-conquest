// Castle Conquest - based on "Castle Wars" by mefistofel (js13kGames 2023, MIT License)
// Camera props and function
var objects3d = [],
    axeX = CreateVector3(1, 0, 0),
    axeY = CreateVector3(0, 1, 0),
    axeZ = CreateVector3(0, 0, 1),
    cameraOffset = CreateVector3(0, 0,-20),
    cameraPosition = CreateVector3(),
    centerOffcet = null,
    cameraScale = 1.6,
    cameraScreenScale = 1,
    projectionFactor = 0.0001


function SetCameraSize(width, height) {
    centerOffcet = CreateVector3(width * 0.5, height * 0.5)
    cameraScreenScale = Math.min(width, height) / 1024
    // tall portrait screens have spare vertical room: zoom in a little
    if (height > width) {
        cameraScreenScale *= 1 + Math.min(1, height / width - 1) * 0.2
    }
}

function SetCameraAngle(angle) {
    // Set iso axes
    let
        isoFactor = 0.6,
        radX = angle / 180.0 * PI,
        radY = (angle / 180.0  + 0.5) * PI
    axeX = CreateVector3(Cos(radX), Sin(radX) * isoFactor, Sin(radX)),
    axeY = CreateVector3(Cos(radY), Sin(radY) * isoFactor, Sin(radY)),
    axeZ = CreateVector3(0, -0.6, 2)
}

var visibleObjects = []

function DrawCamera () {
    // only project and sort the objects that are actually drawn
    // (most castle tiles are hidden below the ground threshold)
    visibleObjects.length = 0
    for (let i = 0; i < objects3d.length; i++) {
        let object = objects3d[i]
        if (object.enable === false)
            continue
        object.prepareScene()
        visibleObjects.push(object)
    }
    visibleObjects.sort(Object3DDepthComparator)
    for (let i = 0; i < visibleObjects.length; i++) {
        visibleObjects[i].draw()
    }
}

function Object3DDepthComparator (objectA, objectB) {
	if (objectA.depth < objectB.depth)
		return 1
	if (objectA.depth > objectB.depth)
		return -1
	return 0
}

// project a world point to the screen (CSS pixels); z is kept for depth sorting.
// Written with plain numbers (no temporary arrays) because it runs for every visible tile.
function WorldToScreenVector3 (point, out = [0, 0, 0]) {
    let
        x = point[0] - cameraPosition[0],
        y = point[1] - cameraPosition[1],
        z = point[2] - cameraPosition[2],
        sx = axeX[0] * x + axeY[0] * y + axeZ[0] * z + cameraOffset[0],
        sy = axeX[1] * x + axeY[1] * y + axeZ[1] * z + cameraOffset[1],
        sz = axeX[2] * x + axeY[2] * y + axeZ[2] * z + cameraOffset[2],
        scale = cameraScale * cameraScreenScale * (1 + sz * projectionFactor)
    out[0] = sx * scale + centerOffcet[0]
    out[1] = sy * scale + centerOffcet[1]
    out[2] = sz * scale + centerOffcet[2]
    return out
}

var projected = [0, 0, 0] // scratch vector

// 3d Quad class
function CreateQuad3D (a, b, c, d, color = CreateVector3(1, 1, 1), offset=0) {
    var quad = {
		screenPoints: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
		depth: 0,
		color: color,
		colorString: null,
		enable: true,
        setPoints(a, b, c, d, position = null) {
            this.points = [a, b, c, d]
            if (position == null)
                this.position = [(a[0] + b[0] + c[0] + d[0]) * 0.25, (a[1] + b[1] + c[1] + d[1]) * 0.25, 0] // middle point
            else
                this.position = position
            this.position[2] = 0
		},
        setColor(newColor) {
            quad.color = newColor
            quad.colorString = null // recomputed lazily in draw()
		},
        prepareScene () {
            if (!quad.enable)
                return
            quad.depth = -WorldToScreenVector3(quad.position, projected)[2] + offset
            for(let i = 0; i < 4; i++) {
                quad.screenPoints[i] = WorldToScreenVector3(quad.points[i], quad.screenPoints[i])
            }
        },
        draw () {
            if (!quad.enable)
                return
            if (quad.colorString == null)
                quad.colorString = Vector3ToColor(quad.color)
            canvas.fillStyle = quad.colorString
            DrawQuad(quad.screenPoints)
        }
    }
    quad.setPoints(a, b, c, d)
    objects3d.push(quad)
    return quad
}

function DrawQuad(points) {
    // ignore backface
    // (same test as PointToLine(points[0], points[1], points[2]) > 0, without allocations)
    let
        dx = points[1][0] - points[0][0],
        dy = points[1][1] - points[0][1],
        dot = dy * (points[0][0] - points[2][0]) - dx * (points[0][1] - points[2][1])
    if (dot > 0)
        return

    canvas.beginPath()
    let last = points[3]
    canvas.moveTo(last[0], last[1])
    for(let i = 0; i < 4; i++) {
        canvas.lineTo(points[i][0], points[i][1])
    }
    canvas.closePath()
    canvas.fill()
}

function Vector3ToColor(vector3) {
    // level should be 0-100
    let r = Round(Clamp01(vector3[0]) * 255)
    let g = Round(Clamp01(vector3[1]) * 255)
    let b = Round(Clamp01(vector3[2]) * 255)
    return RGBToHex(r, g, b)
}

function RGBToHex(r, g, b, a = 255) {
    function componentToHex(c) {
        var hex = c.toString(16)
        return hex.length == 1 ? "0" + hex : hex;
    }
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(a);
}