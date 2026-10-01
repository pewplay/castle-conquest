// Castle Conquest - based on "Castle Wars" by mefistofel (js13kGames 2023, MIT License)
// Main loop, game states, input (Pointer Events) and HTML interface.
const reloadTime = 1.0
const playerFactionId = 0
const storageKey = 'castle-conquest:level'

var now,
	dt = 0,
	step = 1 / 30,
	time = performance.now(),
	doc = document,
	canvasElement = doc.getElementById('game'),
	canvas = canvasElement.getContext('2d'),
	width = 1,
	height = 1,
	pixelRatio = 1,
	minSize = 1,
	labelFontSize = 16,
	cameraValue = 0,
	angle = 0,
	gameObjects = [],
	currentLevel = 0,
	levelName = null,
	tutorStep = 0,
	tutorEndTimer = 0,
	stateFunction = null,
	state = 0,
	usingTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches),
	drag = null // { castle, x, y, moved } while a pointer is held on one of your castles

// --- UI elements ---------------------------------------------------------------
const ui = {
	menu: doc.getElementById('menu'),
	levels: doc.getElementById('levels'),
	result: doc.getElementById('result'),
	hud: doc.getElementById('hud'),
	levelTitle: doc.getElementById('level-title'),
	levelNumber: doc.getElementById('level-number'),
	prevLevel: doc.getElementById('prev-level'),
	resultTitle: doc.getElementById('result-title'),
	resultText: doc.getElementById('result-text'),
	resultMain: doc.getElementById('result-main'),
	hudLevel: doc.getElementById('hud-level'),
	hint: doc.getElementById('hint')
}

try {
	let saved = parseInt(localStorage.getItem(storageKey), 10)
	if (saved >= 0) {
		currentLevel = saved
	}
} catch (e) { /* storage unavailable: start from the tutorial */ }

function saveLevel(level = currentLevel) {
	try {
		localStorage.setItem(storageKey, String(level))
	} catch (e) { /* ignore */ }
}

doc.body.classList.toggle('touch', usingTouch)
updateCanvasSize()

var
	enemy = CreateEnemy() // enemy 1, configured per level by CreateLevel

CreateEnemy(2) // enemy 2
CreateEnemy(3) // enemy 3

cameraScale = 0.7
setState(0)

// --- rendering helpers ---------------------------------------------------------
function render() {
	canvas.fillStyle = '#101010'
	canvas.fillRect(0, 0, width, height)
	DrawCamera()
	drawDragLine()
	drawCastleTexts()
}

// outlined text label (CSS pixels), used for troop counters and tutorial texts
function drawLabel(text, x, y, color, scale = 1) {
	let size = Round(labelFontSize * scale)
	canvas.font = 'bold ' + size + 'px "Trebuchet MS", Arial, sans-serif'
	canvas.textAlign = 'center'
	canvas.textBaseline = 'alphabetic'
	canvas.lineJoin = 'round'
	canvas.lineWidth = Max(2, size * 0.22)
	canvas.strokeStyle = 'rgba(0, 0, 0, 0.75)'
	canvas.strokeText(text, x, y)
	canvas.fillStyle = color
	canvas.fillText(text, x, y)
}

// tutorial / info texts floating above castles, kept inside the screen
function drawCastleTexts() {
	castles.forEach(c => {
		if (c.additionalText == null) {
			return
		}
		let
			lines = c.additionalText.split('\n'),
			size = Round(labelFontSize * 0.95),
			lineHeight = size * 1.25,
			maxWidth = 0
		canvas.font = 'bold ' + size + 'px "Trebuchet MS", Arial, sans-serif'
		lines.forEach(line => { maxWidth = Max(maxWidth, canvas.measureText(line).width) })
		let
			margin = 10,
			x = Min(Max(c.screenTopPosition[0], maxWidth * 0.5 + margin), width - maxWidth * 0.5 - margin),
			y = c.screenTopPosition[1] - labelFontSize * 1.3 - lineHeight * (lines.length - 1)
		y = Max(y, size + margin + (state == 1 ? 56 : 0))
		for (let i = 0; i < lines.length; i++) {
			drawLabel(lines[i], x, y + i * lineHeight, '#ffffff', 0.95)
		}
	})
}

// line from the castle being dragged to the pointer
function drawDragLine() {
	if (drag == null || !drag.moved || stateFunction != updateGame) {
		return
	}
	let
		from = drag.castle.screenPosition,
		fromY = (drag.castle.screenPosition[1] + drag.castle.screenTopPosition[1]) * 0.5,
		target = getCastle([drag.x, drag.y]),
		toX = target ? target.screenPosition[0] : drag.x,
		toY = target ? (target.screenPosition[1] + target.screenTopPosition[1]) * 0.5 : drag.y
	canvas.save()
	canvas.lineCap = 'round'
	canvas.setLineDash([labelFontSize * 0.5, labelFontSize * 0.5])
	canvas.lineWidth = Max(3, labelFontSize * 0.25)
	canvas.strokeStyle = target && target != drag.castle ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)'
	canvas.beginPath()
	canvas.moveTo(from[0], fromY)
	canvas.lineTo(toX, toY)
	canvas.stroke()
	canvas.setLineDash([])
	canvas.beginPath()
	canvas.arc(toX, toY, labelFontSize * 0.45, 0, PI * 2)
	canvas.fillStyle = canvas.strokeStyle
	canvas.fill()
	canvas.restore()
}

// --- states ----------------------------------------------------------------------
// 0 = main menu, -1 = level select, 1 = playing, -2 = won, -3 = lost
function setState(newState) {
	state = newState
	drag = null
	selectedCastle = null
	ui.menu.hidden = newState != 0
	ui.levels.hidden = newState != -1
	ui.result.hidden = newState != -2 && newState != -3
	ui.hud.hidden = newState != 1
	ui.hint.hidden = true

	if (newState == 0) {
		CreateLevel(-1)
		stateFunction = updateMenu
		focusFirstButton(ui.menu)
		return
	}
	if (newState == -1) {
		CreateLevel(currentLevel)
		updateLevelInfo()
		stateFunction = updateLevel
		focusFirstButton(ui.levels)
		return
	}
	if (newState == -2 || newState == -3) {
		let won = newState == -2
		ui.result.classList.toggle('won', won)
		ui.result.classList.toggle('lost', !won)
		ui.resultTitle.textContent = won ? 'Victory!' : 'Defeat'
		ui.resultText.textContent = won
			? (currentLevel == 0 ? 'Tutorial complete. Ready for a real war?' : levelName + ' is yours!')
			: 'Your last castle has fallen.'
		ui.resultMain.textContent = won ? 'Next level' : 'Try again'
		ui.resultMain.dataset.action = won ? 'next' : 'retry'
		if (won) {
			saveLevel(currentLevel + 1) // next time, the level select starts from the next level
		}
		castles.forEach(c => c.additionalText = null)
		updateSelection()
		stateFunction = updateResult
		focusFirstButton(ui.result)
		return
	}
	if (newState == 1) {
		ui.hudLevel.textContent = levelLabel()
		saveLevel()
		if (currentLevel == 0) {
			tutorStep = 0
			nextTutorStep()
			stateFunction = updateTutor
			ui.hint.textContent = (usingTouch ? 'Tap' : 'Click') + ' anywhere to continue'
			ui.hint.hidden = false
			return
		}
		stateFunction = updateGame
		return
	}
}

function focusFirstButton(screen) {
	// keyboard users can confirm with Enter; avoids a stale focus ring on touch
	if (!usingTouch) {
		let button = screen.querySelector('button')
		if (button) {
			button.focus({ preventScroll: true })
		}
	}
}

function levelLabel() {
	return currentLevel == 0 ? 'Tutorial' : 'Level ' + currentLevel + ' · ' + levelName
}

function updateLevelInfo() {
	ui.levelNumber.textContent = currentLevel == 0 ? 'Learn the basics' : 'Level ' + currentLevel
	ui.levelTitle.textContent = levelName
	ui.prevLevel.disabled = currentLevel <= 0
}

function changeLevel(delta) {
	if (currentLevel + delta < 0) {
		return
	}
	currentLevel += delta
	CreateLevel(currentLevel)
	updateLevelInfo()
}

function scaleTo(scale) {
	cameraScale = scale * 0.02 + cameraScale * 0.98
}

// largest zoom (up to `scale`) that keeps every castle and its label on screen,
// leaving room for the interface at the top and bottom
function fitScale(scale, marginTop, marginBottom) {
	if (castles.length == 0) {
		return scale
	}
	let
		savedScale = cameraScale,
		side = Max(40, labelFontSize * 2.4),
		limit = scale,
		top = [0, 0, 0],
		bottom = [0, 0, 0]
	cameraScale = 1
	castles.forEach(c => {
		WorldToScreenVector3(c.position, bottom)
		WorldToScreenVector3([c.position[0], c.position[1], 64], top)
		let
			dx = Abs(bottom[0] - width * 0.5),
			dyBottom = bottom[1] - height * 0.5 + labelFontSize,
			dyTop = height * 0.5 - top[1] + labelFontSize * 1.6
		if (dx > 0) {
			limit = Min(limit, (width * 0.5 - side) / dx)
		}
		if (dyBottom > 0) {
			limit = Min(limit, (height * 0.5 - marginBottom) / dyBottom)
		}
		if (dyTop > 0) {
			limit = Min(limit, (height * 0.5 - marginTop) / dyTop)
		}
	})
	cameraScale = savedScale
	return Max(0.3, limit)
}

function rotateCamera(dt) {
	angle += 8 * dt
	if (angle > 360) {
		angle -= 360
	}
	SetCameraAngle(angle)
}

function fixedCamera(dt) {
	cameraValue += 0.1 * dt
	var needCamera = Sin(cameraValue) * 10 + 65
	angle = angle * 0.9 + needCamera * 0.1
	SetCameraAngle(angle)
}

function updateMenu(dt) {
	scaleTo(1.2)
	rotateCamera(dt)
	maps.forEach(m => m.update(dt))
	render()
}

function updateLevel(dt) {
	let
		titleRect = ui.levels.querySelector('.top').getBoundingClientRect(),
		buttonsRect = ui.levels.querySelector('.bottom').getBoundingClientRect()
	scaleTo(fitScale(1.4, titleRect.bottom + 8, height - buttonsRect.top + 8))
	maps.forEach(m => m.update(dt))
	fixedCamera(dt)
	render()
}

function updateResult(dt) {
	scaleTo(1.2)
	rotateCamera(dt)
	maps.forEach(m => m.update(dt))
	render()
}

function verb() {
	return usingTouch ? 'Tap' : 'Click'
}

function nextTutorStep() {
	tutorStep += 1
	switch (tutorStep) {
		case 1:
			castles[0].additionalText = "This is your castle.\nProtect it!"
			castles[1].additionalText = null
			return
		case 2:
			castles[1].additionalText = "This is your enemy.\nDestroy them!"
			return
		case 3:
			castles[0].additionalText = "Your castles produce troops.\n" + verb() + " your castle to select it."
			castles[1].additionalText = null
			return
		case 4:
			selectedCastle = castles[0]
			findAvailableForMoveCastles(selectedCastle)
			updateSelection()
			castles[0].additionalText = null
			castles[1].additionalText = null
			castles[2].additionalText = verb() + " another castle to send\nyour troops to attack it."
			return
		case 5:
			castles[0].lives = Min(castles[0].lives, 25)
			findAvailableForMoveCastles(castles[0])
			castles[0].sendArmy(castles[2])
			castles[2].additionalText = "You need more troops\nto capture a castle."
			return
		case 6:
			castles[0].lives = Min(castles[0].lives, 21)
			castles[0].additionalText = "You can also spend troops\nto upgrade ▲ your castles."
			castles[2].additionalText = null
			return
		case 7:
			castles[0].lives = Min(castles[0].lives, 21)
			castles[0].additionalText = "Bigger castles produce more troops.\n" + verb() + " your selected castle to upgrade it."
			return
		case 8:
			castles[0].upgrade()
			castles[0].additionalText = "Let the battle begin!"
			return
	}
	castles[0].additionalText = null
	castles[1].additionalText = "Defeat your enemies!"
	tutorEndTimer = 4
	ui.hint.hidden = true
	stateFunction = updateGame
}

function gameScale() {
	return fitScale(1.6, 64, ui.hint.hidden ? 16 : 72)
}

function updateTutor(dt) {
	scaleTo(gameScale())
	maps.forEach(m => m.update(dt))
	gameObjects.forEach(g => g.update(dt))
	fixedCamera(dt)
	render()
}

function updateGame(dt) {
	scaleTo(gameScale())
	maps.forEach(m => m.update(dt))

	// a selected castle captured by the enemy can no longer be commanded
	if (selectedCastle != null && selectedCastle.factionId != playerFactionId) {
		selectCastle(null)
	}
	if (tutorEndTimer > 0) {
		tutorEndTimer -= dt
		if (tutorEndTimer <= 0) {
			castles.forEach(c => c.additionalText = null)
		}
	}

	// check win conditions
	let
		playerCount = 0,
		enemyCount = 0
	castles.forEach(c => {
		if (c.factionId == 0) {
			playerCount += 1
		}
		if (c.factionId > 0) {
			enemyCount += 1
		}
	})

	gameObjects.forEach(g => g.update(dt))
	fixedCamera(dt)
	render()

	if (playerCount == 0) {
		setState(-3) // lost
	} else if (enemyCount == 0) {
		setState(-2) // won
	}
}

// --- player commands ---------------------------------------------------------------
function selectCastle(castle) {
	selectedCastle = castle
	findAvailableForMoveCastles(selectedCastle)
	updateSelection()
}

function sendTroops(from, target) {
	if (from == null || target == null || from == target) {
		return
	}
	findAvailableForMoveCastles(from)
	from.sendArmy(target)
	// keep the reachable-castles highlight in sync with the selection
	findAvailableForMoveCastles(selectedCastle)
}

// tap / left click
function primaryAction(castle) {
	if (castle == null) {
		selectCastle(null)
		return
	}
	if (castle == selectedCastle) {
		castle.upgrade()
		return
	}
	if (castle.factionId == playerFactionId) {
		selectCastle(castle)
		return
	}
	if (selectedCastle != null) {
		sendTroops(selectedCastle, castle)
	}
}

// right click (original controls): send troops, or upgrade the selected castle
function secondaryAction(castle) {
	if (selectedCastle == null || castle == null) {
		return
	}
	if (castle == selectedCastle) {
		selectedCastle.upgrade()
	} else {
		sendTroops(selectedCastle, castle)
	}
}

// --- input ---------------------------------------------------------------------------
function pointerPosition(event) {
	let rect = canvasElement.getBoundingClientRect()
	return [event.clientX - rect.left, event.clientY - rect.top]
}

canvasElement.addEventListener('pointerdown', event => {
	usingTouch = event.pointerType == 'touch' || event.pointerType == 'pen'
	event.preventDefault()
	if (stateFunction == updateTutor) {
		nextTutorStep()
		return
	}
	if (stateFunction != updateGame || (drag && drag.pointerId != event.pointerId)) {
		return
	}
	let
		pos = pointerPosition(event),
		castle = getCastle(pos)
	drag = {
		pointerId: event.pointerId,
		button: event.button,
		castle: castle,
		startX: pos[0],
		startY: pos[1],
		x: pos[0],
		y: pos[1],
		moved: false
	}
	try {
		canvasElement.setPointerCapture(event.pointerId)
	} catch (e) { /* ignore */ }
})

canvasElement.addEventListener('pointermove', event => {
	if (drag == null || drag.pointerId != event.pointerId) {
		return
	}
	let pos = pointerPosition(event)
	drag.x = pos[0]
	drag.y = pos[1]
	let threshold = event.pointerType == 'mouse' ? 8 : 14
	if (!drag.moved && Math.hypot(pos[0] - drag.startX, pos[1] - drag.startY) > threshold) {
		// dragging only means something when it starts on one of your castles
		if (drag.castle != null && drag.castle.factionId == playerFactionId) {
			drag.moved = true
			if (selectedCastle != drag.castle) {
				selectCastle(drag.castle)
			}
		}
	}
})

function endPointer(event, cancelled) {
	if (drag == null || drag.pointerId != event.pointerId) {
		return
	}
	let current = drag
	drag = null
	if (cancelled || stateFunction != updateGame) {
		return
	}
	let target = getCastle([current.x, current.y])
	if (current.moved) {
		// drag from your castle to any other castle: send troops
		if (target != null && current.castle.factionId == playerFactionId) {
			sendTroops(current.castle, target)
		}
		return
	}
	if (current.button == 2) {
		secondaryAction(current.castle)
	} else {
		primaryAction(current.castle)
	}
}

canvasElement.addEventListener('pointerup', event => endPointer(event, false))
canvasElement.addEventListener('pointercancel', event => endPointer(event, true))
doc.addEventListener('contextmenu', event => event.preventDefault())

doc.addEventListener('keydown', event => {
	let key = event.key
	if (key == 'Escape') {
		if (state == -1 || state == 1 || state == -2 || state == -3) {
			event.preventDefault()
			setState(state == 1 ? -1 : 0) // battle -> level select, other screens -> main menu
		}
		return
	}
	if (state == 0 && (key == ' ' || key == 'Enter')) {
		event.preventDefault()
		setState(-1)
		return
	}
	if (state == -1) {
		if (key == ' ') {
			event.preventDefault()
			setState(1)
		} else if (key == 'ArrowRight') {
			event.preventDefault()
			changeLevel(1)
		} else if (key == 'ArrowLeft') {
			event.preventDefault()
			changeLevel(-1)
		}
		return
	}
	if (stateFunction == updateTutor && (key == ' ' || key == 'Enter')) {
		event.preventDefault()
		nextTutorStep()
	}
})

// HTML buttons
doc.addEventListener('click', event => {
	let button = event.target.closest('button[data-action]')
	if (!button) {
		return
	}
	switch (button.dataset.action) {
		case 'play': setState(-1); break
		case 'start': setState(1); break
		case 'prev': changeLevel(-1); break
		case 'next-level': changeLevel(1); break
		case 'back': setState(0); break
		case 'quit': setState(-1); break
		case 'menu': setState(0); break
		case 'retry': setState(-1); setState(1); break
		case 'next': currentLevel += 1; setState(-1); setState(1); break
	}
})
doc.addEventListener('pointerdown', event => {
	usingTouch = event.pointerType == 'touch' || event.pointerType == 'pen'
	doc.body.classList.toggle('touch', usingTouch)
}, true)

// --- main loop ---------------------------------------------------------------------
function frame() {
	now = performance.now()
	dt = Min(step, Max(0, (now - time) / 1000))
	time = now
	if (canvasElement.clientWidth != width || canvasElement.clientHeight != height ||
		Min(window.devicePixelRatio || 1, 2) != pixelRatio) {
		updateCanvasSize()
	}
	stateFunction(dt)
	requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// the game is paused while the page is hidden (requestAnimationFrame stops);
// reset the clock so nothing jumps when it comes back
doc.addEventListener('visibilitychange', () => {
	time = performance.now()
	drag = null
})

function updateCanvasSize() {
	width = Max(1, canvasElement.clientWidth)
	height = Max(1, canvasElement.clientHeight)
	pixelRatio = Min(window.devicePixelRatio || 1, 2)
	minSize = Min(width, height)
	labelFontSize = Max(14, Min(26, Round(minSize * 0.034)))

	canvasElement.width = Round(width * pixelRatio)
	canvasElement.height = Round(height * pixelRatio)
	canvas.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

	SetCameraSize(width, height)
}
