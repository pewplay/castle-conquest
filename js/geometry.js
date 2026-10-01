// Castle Conquest - based on "Castle Wars" by mefistofel (js13kGames 2023, MIT License)
// Geometry helpers: 2D / 3D vectors stored as plain arrays.
const MAX_NUMBER = Number.MAX_VALUE
const MIN_NUMBER = Number.MIN_VALUE
const PI = Math.PI
const Cos = Math.cos
const Sin = Math.sin
const Min = Math.min
const Max = Math.max
const Abs = Math.abs
const Round = Math.round
const Random = Math.random
const Floor = Math.floor

function Clamp01(value) {
	return Max(Min(value, 1), 0)
}

// vector 2 functions
function CreateVector2(x = 0.0, y = 0.0) {
	return [x, y]
}

function AddVector2(a, b) {
	return [a[0] + b[0], a[1] + b[1]]
}

function SubstractVector2(a, b) {
	return [a[0] - b[0], a[1] - b[1]]
}

function MultiplyVector2(v, multiplier) {
	return [v[0] * multiplier, v[1] * multiplier]
}

function Vector2Distance(a, b) {
	return Vector2Length(SubstractVector2(a, b))
}

function Vector2Length(v) {
	return Math.sqrt(v[0] * v[0] + v[1] * v[1])
}

function NormalizeVector2(v) {
	var dist = 1.0 / Vector2Length(v)
	if (dist == Infinity) {
		dist = MAX_NUMBER
	}
	if (dist == -Infinity) {
		dist = MIN_NUMBER
	}
	return MultiplyVector2(v, dist)
}

function DotProductVector2(a, b) {
	return a[0] * b[0] + a[1] * b[1]
}

// signed distance of a point from a line (used for back-face culling)
function PointToLine(lineStart, lineEnd, point) {
	let lineDirection = SubstractVector2(lineEnd, lineStart)
	let perpendicular = [lineDirection[1], -lineDirection[0]]
	let pointDirection = SubstractVector2(lineStart, point)
	return DotProductVector2(NormalizeVector2(perpendicular), pointDirection)
}

function FindMiddlePoint(points) {
	let sum = CreateVector3()
	for (let i = 0; i < points.length; i++) {
		sum = AddVector3(sum, points[i])
	}
	return MultiplyVector3(sum, 1.0 / points.length)
}

// vector 3 functions
function CreateVector3(x = 0.0, y = 0.0, z = 0.0) {
	return [x, y, z]
}

function AddVector3(a, b) {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function SubstractVector3(a, b) {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function MultiplyVector3(v, multiplier) {
	return [v[0] * multiplier, v[1] * multiplier, v[2] * multiplier]
}

function Vector3Length(v) {
	return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}
