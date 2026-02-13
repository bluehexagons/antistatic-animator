import path from './runtime/path'
import fs from './runtime/fs'
import * as JSONC from 'jsonc-parser'

import {
  characterDir,
  characterData,
  objHas,
  watchCharacters,
} from './utils'
import {Ease} from './easing'

const global = window as any

const enum Actions {
  none = 0,
  moveHurtbubble = 1,
  panCamera = 2,
}

type HurtbubbleData = {
  name: string
  i1: number
  i2: number
  z: number
  ik: boolean
}

type Hitbubble = {
  [prop: string]: any
  x?: number
  y?: number
  radius?: number
  follow?: string
  type?: string
}
type Hurtbubble = number
type Keyframe = {
  duration: number
  hitbubbles?: Hitbubble[] | true
  hurtbubbles?: Hurtbubble[]
}
type Animation = {
  [property: string]: any
  keyframes: Keyframe[]
}
type AnimationMap = {
  [name: string]: Animation
}
type EntityData = {
  name: string
  hurtbubbles: HurtbubbleData[]
  [name: string]: any
}
type Multichoices = {
  default: string
  choices: string[]
}

let keyframesElement = null as HTMLElement
let bubblesElement = null as HTMLElement
const clearUI = () => {
  while (keyframesElement.firstChild) {
    keyframesElement.removeChild(keyframesElement.firstChild)
  }
  while (bubblesElement.firstChild) {
    bubblesElement.removeChild(bubblesElement.firstChild)
  }
}

const multichoice: {[s: string]: Multichoices} = {
  tween: {
    default: 'linear',
    choices: Object.getOwnPropertyNames(Ease),
  },
}
const defaultTypes: {[s: string]: string} = {
  tween: 'string',
  duration: 'number',
  interpolate: 'bool',
  audio: 'string',
  cancellable: 'string',
  type: 'number',
  noCancel: 'string',
  iasa: 'number',
  early: 'number',
  late: 'number',
  handler: 'string',
  slid: 'string',
  transition: 'string',
  gravity: 'number',
  start: 'string',
  nodi: 'boolean',
  noFastfall: 'boolean',
  itan: 'boolean',
  interrupted: 'string',
  end: 'string',
  starKO: 'boolean',
  techable: 'boolean',
  bufferable: 'string',
  buffertime: 'number',
  platformDroppable: 'boolean',
  speed: 'number',
  slideFriction: 'number',
  friction: 'number',
  ungrabbable: 'boolean',
  effect: 'string',
  itanStart: 'number',
  itanEnd: 'number',
  grabDirections: 'number',
  helpless: 'boolean',
  disableIK: 'boolean',
  pause: 'number',
  reset: 'boolean',
  refresh: 'boolean',
  rooted: 'boolean',
  dx: 'number',
  dy: 'number',
  jumpSpeed: 'number',
  dashSpeed: 'number',
  acceleration: 'number',
  unbufferable: 'boolean',
  di: 'number',
  upward: 'number',
  fallFriction: 'number',
  noCancelInterrupt: 'boolean',
  jump: 'number',
  fullJump: 'number',
  alwaysHandle: 'boolean',
  specialDrop: 'boolean',
  shieldbrake: 'boolean',
  shielded: 'string',
  buffer: 'string',
  airdodgeSpeed: 'number',
  aerodynamics: 'number',
  airResistance: 'number',
  decay: 'number',
  pseudojump: 'boolean',
  ledgestall: 'boolean',
  holdingAnimation: 'string',
  heldAnimation: 'string',
  cost: 'number',
  noLedgeGrab: 'boolean',
  drain: 'number',
  release: 'string',
  drained: 'string',
  reversible: 'boolean',
  blocked: 'string',
  scale: 'number',
}

const excludeProps = new Set(['hitbubbles', 'keyframes', 'hurtbubbles'])
const makePropDisplay = (obj: any, isKeyframe = false) => {
  const div = document.createElement('div')
  const propList = Object.getOwnPropertyNames(obj)
  const addRow = document.createElement('div')
  const addProp = document.createElement('span')
  const addType = document.createElement('select')
  const addButton = document.createElement('button')
  let option = document.createElement('option')
  const submitProp = () => {
    if (addProp.textContent === '') {
      return
    }
    switch (addType.value) {
      case 'bool':
        obj[addProp.textContent] = true
        break
      case 'string':
        obj[addProp.textContent] = ''
        break
      case 'number':
        obj[addProp.textContent] = 0
        break
    }
    if (objHas(multichoice, addProp.textContent)) {
      obj[addProp.textContent] = multichoice[addProp.textContent].default
    }
    const input = addPropRow(addProp.textContent)
    if (input === null) {
    } else if (input instanceof HTMLInputElement) {
      input.select()
    } else {
      // span or other text node
      const range = document.createRange()
      range.selectNodeContents(input)
      getSelection().removeAllRanges()
      getSelection().addRange(range)
    }

    addProp.textContent = ''
  }
  div.className = 'prop-list'
  addRow.className = 'prop'
  addProp.className = 'input'
  addProp.contentEditable = 'true'
  option.text = 'bool'
  addType.add(option)
  option = document.createElement('option')
  option.text = 'number'
  addType.add(option)
  option = document.createElement('option')
  option.text = 'string'
  addType.add(option)

  addButton.className = 'prop-btn'
  addButton.appendChild(document.createTextNode('+'))
  addButton.addEventListener('click', submitProp)
  addProp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      submitProp()
      e.preventDefault()
      return false
    }
    return true
  })
  addProp.addEventListener('input', e => {
    if (objHas(defaultTypes, addProp.textContent)) {
      addType.value = defaultTypes[addProp.textContent]
    }
  })
  addRow.appendChild(addProp)
  addRow.appendChild(addType)
  addRow.appendChild(addButton)
  div.appendChild(addRow)
  const addPropRow = (
    k: string
  ): HTMLSpanElement | HTMLInputElement | HTMLSelectElement | null => {
    let v = obj[k]

    const row = document.createElement('div')
    const label = document.createElement('label')
    let input: HTMLSpanElement | HTMLInputElement | HTMLSelectElement = null
    const remove = document.createElement('button')
    const update = () => {
      switch (typeof v) {
        case 'string':
          if (
            input instanceof HTMLInputElement
            || input instanceof HTMLSelectElement
          ) {
            obj[k] = input.value
          } else {
            obj[k] = input.textContent
          }
          if (
            objHas(multichoice, k)
            && multichoice[k].default === obj[k]
          ) {
            delete obj[k]
          }
          break
        case 'number':
          obj[k] = parseFloat(input.textContent)
          input.textContent = obj[k].toString(10)
          break
        case 'boolean':
          obj[k] = (input as HTMLInputElement).checked
          input.textContent = obj[k] ? 'true' : 'false'
          break
        case 'undefined':
          break
        default:
          if (Array.isArray(v)) {
            const parsed = JSONC.parse(input.textContent)
            if (Array.isArray(parsed)) {
              obj[k] = parsed
              input.textContent = JSON.stringify(obj[k])
            }
            break
          }
        // not editable yet
      }
    }
    if (objHas(multichoice, k) && !v) {
      v = multichoice[k].default
    }
    switch (typeof v) {
      case 'boolean':
        if (!v) {
          input = document.createElement('span')
        }
        break
      case 'string':
        if (objHas(multichoice, k)) {
          const choices = multichoice[k].choices
          input = document.createElement('select')
          for (let i = 0; i < choices.length; i++) {
            const o = document.createElement('option')
            o.value = choices[i]
            o.textContent = choices[i]
            ;(input as HTMLSelectElement).options.add(o)
          }
        } else {
          input = document.createElement('span')
        }
        break
      default:
        input = document.createElement('span')
    }
    if (excludeProps.has(k) && (k !== 'hitbubbles' || v !== true)) {
      return null
    }
    row.className = 'prop'
    label.appendChild(
      document.createTextNode(k + (typeof v !== 'boolean' ? ':' : ''))
    )
    if (input instanceof HTMLSelectElement) {
      if (objHas(multichoice, k) && !v) {
        v = ''
        input.value = multichoice[k].default
      } else {
        input.value = v
      }

      input.addEventListener('change', () => {
        update()
      })
    } else if (input instanceof HTMLSpanElement) {
      input.contentEditable = 'true'
      input.className = 'input'
      switch (typeof v) {
        case 'string':
          input.textContent = v
          break
        case 'number':
          input.textContent = v.toString(10)
          break
        case 'boolean':
          input.textContent = v ? 'true' : 'false'
          break
        default:
          if (Array.isArray(v)) {
            input.textContent = JSON.stringify(v)
            break
          }
          input.contentEditable = 'false'
          input.textContent = `<${typeof v}>`
          break
      }
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          update()
          e.preventDefault()
          return false
        }
        return true
      })
      input.addEventListener('blur', update)
    }
    remove.appendChild(document.createTextNode('\u00d7'))
    remove.className = 'prop-btn'
    remove.addEventListener('click', () => {
      delete obj[k]
      div.removeChild(row)
    })
    row.appendChild(label)
    if (input !== null) {
      row.appendChild(input)
    }
    row.appendChild(remove)
    div.insertBefore(row, addRow)
    return input
  }
  for (let i = 0; i < propList.length; i++) {
    addPropRow(propList[i])
  }
  if (isKeyframe && !objHas(obj, 'tween')) {
    addPropRow('tween')
  }
  return div
}
const makeStatDisplay = (obj: Animation) => {
  const div = document.createElement('div')
  let windup = 0
  let frame = 0
  const hitboxTimings: string[] = []
  let backswing = 0
  let kfn = 0
  const kfs = obj.keyframes

  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn]
    if (objHas(kf, 'hitbubbles')) {
      break
    }
    frame += kf.duration
    windup += kf.duration
  }

  let lastHB = kfn
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn]
    frame += kf.duration
    if (!objHas(kf, 'hitbubbles')) {
      continue
    }
    lastHB = kfn
    hitboxTimings.push(`${frame - kf.duration + 1}-${frame}`)
  }

  kfn = lastHB + 1
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn]
    backswing += kf.duration
  }
  frame = 0
  for (let i = 0; i < kfs.length - 1; i++) {
    frame += kfs[i].duration
  }
  if (objHas(obj, 'iasa')) {
    backswing -= obj['iasa']
    frame -= obj['iasa']
  }
  const totalEl = document.createElement('div')
  totalEl.appendChild(document.createTextNode('Duration: ' + frame))
  const windupEl = document.createElement('div')
  windupEl.appendChild(document.createTextNode('Windup: ' + windup))
  const hitbubblesEl = document.createElement('div')
  hitbubblesEl.appendChild(
    document.createTextNode('Hits: ' + hitboxTimings.join(', '))
  )
  const backswingEl = document.createElement('div')
  backswingEl.appendChild(document.createTextNode('Backswing: ' + backswing))
  div.appendChild(totalEl)
  div.appendChild(windupEl)
  div.appendChild(hitbubblesEl)
  div.appendChild(backswingEl)
  return div
}
// these included for easier copying and pasting
const working = [0, 0]
const point = (x: number, y: number) => {
  working[0] = x
  working[1] = y
}
const pathCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angles = 8
) => {
  let perp = -Math.PI
  const step = (1 / angles) * Math.PI * 2

  ctx.beginPath()
  point(x + Math.cos(perp) * r, y + Math.sin(perp) * r)
  ctx.moveTo(working[0], working[1])
  for (let i = 0; i < angles; i++) {
    perp += step
    point(x + Math.cos(perp) * r, y + Math.sin(perp) * r)
    ctx.lineTo(working[0], working[1])
  }
  ctx.closePath()
}
const pathCapsule = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  r: number,
  angles = 4
) => {
  const rads = 2 * Math.PI - Math.atan2(x2 - x, y2 - y)
  let perp = rads - Math.PI
  const step = (1 / angles) * Math.PI

  ctx.beginPath()
  point(x + Math.cos(perp) * r, y + Math.sin(perp) * r)
  ctx.moveTo(working[0], working[1])
  for (let i = 0; i < angles; i++) {
    perp += step
    point(x + Math.cos(perp) * r, y + Math.sin(perp) * r)
    ctx.lineTo(working[0], working[1])
  }
  perp = rads + Math.PI * 2
  for (let i = 0; i < angles + 1; i++) {
    point(x2 + Math.cos(perp) * r, y2 + Math.sin(perp) * r)
    ctx.lineTo(working[0], working[1])
    perp += step
  }
  ctx.closePath()
}
const dragging = {
  active: -1,
  x: 0,
  y: 0,
  action: Actions.none,
  startX: 0,
  startY: 0,
}
const editing = {
  character: null as EntityData,
  animation: null as Animation,
  keyframe: 0,
  bubble: -1,
}
console.log('character is window.editing')
global['editing'] = editing
const editorCamera = {x: 0, y: 0.1, scale: 2}
const refreshEditor = () => {
  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height)
  paintBubbles(
    editing.character,
    editing.animation,
    editing.keyframe,
    editorCtx,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale,
    lastHovered,
    editing.bubble
  )
}
const editorFindBubbles = (e: MouseEvent) => {
  const bs = findBubbles(
    editing.character,
    editing.animation,
    editing.keyframe,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale,
    e.offsetX,
    e.offsetY
  )
  let hover = -1
  if (bs.length !== 0) {
    hover = bs[0] * 0.25
  }
  if (lastHovered === hover) {
    return false
  }
  lastHovered = hover
  return true
}
let keysdown = 0
const direction = {
  up: 1 << 0,
  left: 1 << 1,
  down: 1 << 2,
  right: 1 << 3,
}
const nudgeDelay = 120
const keydownEditor = (e: KeyboardEvent) => {
  let dx = 0
  let dy = 0
  if (editing.bubble < 0) {
    return
  }

  switch (e.key) {
    case 'w':
    case 'ArrowUp':
      if (~keysdown & direction.up) {
        dy++
        keysdown = keysdown | direction.up
      }
      break
    case 'a':
    case 'ArrowLeft':
      if (~keysdown & direction.left) {
        dx--
        keysdown = keysdown | direction.left
      }
      break
    case 's':
    case 'ArrowDown':
      if (~keysdown & direction.down) {
        dy--
        keysdown = keysdown | direction.down
      }
      break
    case 'd':
    case 'ArrowRight':
      if (~keysdown & direction.right) {
        dx++
        keysdown = keysdown | direction.right
      }
      break
  }

  if (dx === 0 && dy === 0) {
    return
  }

  e.preventDefault()
  if (keytickTimeout === null && keytickAnimate === 0) {
    startTicks = Date.now() + nudgeDelay
    numTicks = 0
    keytickTimeout = setTimeout(() => {
      keytickTimeout = null
      keytick()
    }, nudgeDelay)
  }
  const b = editing.bubble
  const hbs = editing.animation.keyframes[editing.keyframe].hurtbubbles
  updateUI[b](hbs[b * 4] + dx, hbs[b * 4 + 1] + dy, b)
}
let keytickTimeout: NodeJS.Timer = null
let keytickAnimate = 0

let startTicks = 0
const speed = 16
let numTicks = 0
const keytick = () => {
  const difference = (((Date.now() - startTicks) / speed) | 0) - numTicks
  for (let i = 0; i < difference; i++) {
    numTicks++
    let dx = 0
    let dy = 0
    if (editing.bubble < 0) {
      return
    }

    if (keysdown & direction.up) {
      dy++
    }
    if (keysdown & direction.left) {
      dx--
    }
    if (keysdown & direction.down) {
      dy--
    }
    if (keysdown & direction.right) {
      dx++
    }

    if (dx !== 0 || dy !== 0) {
      const b = editing.bubble
      const hbs = editing.animation.keyframes[editing.keyframe].hurtbubbles
      updateUI[b](hbs[b * 4] + dx, hbs[b * 4 + 1] + dy, b)
    }
  }
  keytickAnimate = requestAnimationFrame(keytick)
}
const keyupEditor = (e: KeyboardEvent) => {
  const wasStarted = keysdown !== 0
  if (wasStarted) {
    e.preventDefault()
  }
  switch (e.key) {
    case 'w':
    case 'ArrowUp':
      keysdown = keysdown & ~direction.up
      break
    case 'a':
    case 'ArrowLeft':
      keysdown = keysdown & ~direction.left
      break
    case 's':
    case 'ArrowDown':
      keysdown = keysdown & ~direction.down
      break
    case 'd':
    case 'ArrowRight':
      keysdown = keysdown & ~direction.right
      break
  }
  if (keysdown === 0) {
    cancelAnimationFrame(keytickAnimate)
    keytickAnimate = 0
    if (keytickTimeout !== null) {
      clearTimeout(keytickTimeout)
      keytickTimeout = null
    }
  }
}
const downEditor = (e: MouseEvent) => {
  if (editing.character === null || editing.animation === null) {
    return
  }

  if (e.buttons === 1) {
    // left
    editorFindBubbles(e)

    dragging.active = lastHovered
    editing.bubble = lastHovered
    if (lastHovered === -1) {
      refreshEditor()
      return
    }
    const hbs = editing.animation.keyframes[editing.keyframe].hurtbubbles
    const x
      = (e.offsetX - editorCanvas.width * (0.5 + editorCamera.x * 0.5))
      / editorCamera.scale
    const y
      = -(e.offsetY - editorCanvas.height * (0.5 + editorCamera.y * 0.5))
      / editorCamera.scale
    dragging.action = Actions.moveHurtbubble
    dragging.x = hbs[lastHovered * 4] - x
    dragging.y = hbs[lastHovered * 4 + 1] - y
    refreshEditor()
    return
  }
  if (e.buttons === 2) {
    // right
    dragging.action = Actions.panCamera
    dragging.startX = editorCamera.x
    dragging.startY = editorCamera.y
    dragging.x = e.offsetX
    dragging.y = e.offsetY
    return
  }
}
let lastHovered = -1
let lastFound = false
const moveEditor = (e: MouseEvent) => {
  e.preventDefault()
  if (editing.character === null || editing.animation === null) {
    return
  }
  switch (dragging.action) {
    case Actions.moveHurtbubble:
      {
        const ox = editorCamera.x
        const oy = editorCamera.y
        const w = editorCanvas.width
        const h = editorCanvas.height
        const x = (e.offsetX - w * (0.5 + ox * 0.5)) / editorCamera.scale
        const y = -(e.offsetY - h * (0.5 + oy * 0.5)) / editorCamera.scale
        updateUI[dragging.active](
          (dragging.x + x) | 0,
          (dragging.y + y) | 0,
          dragging.active
        )
        refreshEditor()
      }
      return

    case Actions.panCamera:
      editorCamera.x
        = dragging.startX
        + ((e.offsetX - dragging.x) / editorCanvas.width) * editorCamera.scale
      editorCamera.y
        = dragging.startY
        + ((e.offsetY - dragging.y) / editorCanvas.height) * editorCamera.scale
      refreshEditor()
      return
  }

  const newFound = editorFindBubbles(e)
  if (newFound !== lastFound) {
    refreshEditor()
    lastFound = newFound
  }
}
const upEditor = (e: MouseEvent) => {
  if (
    editing.character === null
    || editing.animation === null
    || dragging.action === Actions.none
  ) {
    return
  }
  moveEditor(e)
  dragging.active = -1
  dragging.action = Actions.none
  e.preventDefault()
}
const updateUI: ((x: number, y: number, highlight: number) => void)[] = []
const makeKeyframeEditor = (
  element: HTMLElement,
  character: EntityData,
  animation: Animation,
  keyframe: number,
  updateThumbnail: () => void
) => {
  const kf = animation.keyframes[keyframe]
  const hb = kf.hurtbubbles
  updateUI.length = 0
  for (let i = 0; i < hb.length; i = i + 4) {
    ;((n: number, hb: number[]) => {
      const line = document.createElement('div')
      const x = document.createElement('span')
      const y = document.createElement('span')
      const r = document.createElement('span')
      const t = document.createElement('span')

      x.contentEditable = 'true'
      x.className = 'input'
      y.contentEditable = 'true'
      y.className = 'input'
      r.contentEditable = 'true'
      r.className = 'input'
      t.contentEditable = 'true'
      t.className = 'input'

      x.textContent = hb[n].toString(10)
      y.textContent = hb[n + 1].toString(10)
      r.textContent = hb[n + 2].toString(10)
      t.textContent = hb[n + 3].toString(10)

      line.appendChild(x)
      line.appendChild(document.createTextNode(','))
      line.appendChild(y)
      line.appendChild(document.createTextNode(' (r='))
      line.appendChild(r)
      line.appendChild(document.createTextNode(', state='))
      line.appendChild(t)
      line.appendChild(document.createTextNode(')'))

      const update = () => {
        const scale = 2
        const focused = line.contains(document.activeElement) ? n * 0.25 : -1
        hb[n] = parseFloat(x.textContent)
        hb[n + 1] = parseFloat(y.textContent)
        hb[n + 2] = parseFloat(r.textContent)
        hb[n + 3] = parseFloat(t.textContent)

        editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height)
        paintBubbles(
          character,
          animation,
          keyframe,
          editorCtx,
          editorCamera.x,
          editorCamera.y,
          editorCanvas.width,
          editorCanvas.height,
          scale,
          focused
        )
        updateThumbnail()
      }
      const updateCoords = (xc: number, yc: number, highlight: number) => {
        const scale = 2
        x.textContent = xc.toString(10)
        y.textContent = yc.toString(10)
        hb[n] = xc
        hb[n + 1] = yc
        editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height)
        paintBubbles(
          character,
          animation,
          keyframe,
          editorCtx,
          editorCamera.x,
          editorCamera.y,
          editorCanvas.width,
          editorCanvas.height,
          scale,
          highlight
        )
        updateThumbnail()
      }
      updateUI.push(updateCoords)
      const testKey = (e: KeyboardEvent) => {
        let dx = 0
        let dy = 0
        switch (e.key) {
          case 'Enter':
            update()
            e.preventDefault()
            return false
          case 'w':
            dy = 1
            break
          case 'd':
            dx = 1
            break
          case 's':
            dy = -1
            break
          case 'a':
            dx = -1
            break
        }

        if (dx !== 0 || dy !== 0) {
          updateCoords(
            hb[n] + dx,
            hb[n + 1] + dy,
            line.contains(document.activeElement) ? n * 0.25 : -1
          )
          e.preventDefault()
          return false
        }
        return true
      }

      ;[x, y, r, t].forEach(e => {
        e.addEventListener('keydown', testKey)
        e.addEventListener('blur', update)
        e.addEventListener('focus', update)
      })

      element.appendChild(line)
    })(i, hb)
  }
}

let playInterval = null
let playSpeed = 60
let playStarted = 0
const activeAnimation: Animation = null
const renderAnimation = () => {
  const frame = Math.abs(performance.now() / (1 / 60 * 1000)) - playStarted
  paintBubbles(
    character,
    activeAnimation,
    frame,
    editorCtx,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale
  )
  playInterval = requestAnimationFrame(renderAnimation)
}
const playAnimation = (hurtbubbles: any, character: EntityData, animation: Animation) => {
  if (playInterval === null) {
    // setAnimationSpeed(playSpeed)
    playStarted = Math.abs(performance.now() / (1 / 60 * 1000))
  }

}
const setAnimationSpeed = (fps: number) => {
  if (playInterval !== null) {
    cancelAnimationFrame(playInterval)
  }

  if (fps <= 0) {
    playInterval = null
  } else {
    playSpeed = fps
    playInterval = requestAnimationFrame(renderAnimation)
  }
}

const showEditor = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  updateThumbnail: () => void
) => {
  // clear hurtbubble editor
  while (editorHurtbubbles.firstChild) {
    editorHurtbubbles.removeChild(editorHurtbubbles.firstChild)
  }

  // build hurtbubble editor
  makeKeyframeEditor(
    editorHurtbubbles,
    character,
    animation,
    keyframe,
    updateThumbnail
  )

  // playAnimation(
  //   character,
  //   animation
  // )

  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height)
  editing.character = character
  editing.animation = animation
  editing.keyframe = keyframe
  editing.bubble = -1
  paintBubbles(
    character,
    animation,
    keyframe,
    editorCtx,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale
  )
  for (let i = 0; i < bubblesElement.children.length; i++) {
    bubblesElement.children[i].classList.remove('highlighted')
  }
  bubblesElement.children[keyframe].classList.add('highlighted')
}
const hbmap = (hbs: HurtbubbleData[]) => {
  const m = new Map<string, number>()
  for (let i = 0; i < hbs.length; i++) {
    m.set(hbs[i].name, i + 1)
    m.set(`${hbs[i].name}2`, -i - 1)
  }
  return m
}

const findBubbles = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
  scale: number,
  x: number,
  y: number
) => {
  const bubbles: number[] = []
  const dists: number[] = []
  const wx = (x - w * (0.5 + ox * 0.5)) / scale
  const wy = -(y - h * (0.5 + oy * 0.5)) / scale

  const hb = animation.keyframes[keyframe].hurtbubbles

  for (let i = 0; i < hb.length; i = i + 4) {
    const [hbx, hby, hbr] = [hb[i + 0], hb[i + 1], hb[i + 2]]
    const dx = hbx - wx
    const dy = hby - wy
    const sqDist = dx * dx + dy * dy
    const sqRadius = hbr * hbr
    dists.push(sqDist)
    if (sqDist < sqRadius) {
      bubbles.push(i)
    }
  }
  return bubbles.sort((a, b) => {
    return dists[a * 0.25] - dists[b * 0.25]
  })
}
const paintBubbles = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  scale: number,
  highlight = -1,
  active = -1
) => {
  const kf = animation.keyframes[keyframe]
  const hurtbubbles = kf.hurtbubbles
  const charhbs = character.hurtbubbles
  let hitbubbles: Hitbubble[] = null
  if (objHas(kf, 'hitbubbles')) {
    let ckf = kf
    let hbkf = keyframe
    while (ckf.hitbubbles === true) {
      hbkf--
      ckf = animation.keyframes[hbkf]
    }
    hitbubbles = ckf.hitbubbles
  }

  ox = w * (0.5 + ox * 0.5)
  oy = h * (0.5 + oy * 0.5)

  // draw origin grid (aligned to half-pixel offsets)
  ctx.beginPath()
  ctx.moveTo(0, (oy | 0) + 0.5)
  ctx.lineTo(w, (oy | 0) + 0.5)
  ctx.moveTo((ox | 0) + 0.5, 0)
  ctx.lineTo((ox | 0) + 0.5, h)
  ctx.strokeStyle = '#666'
  ctx.stroke()

  // draw hitbubbles
  if (hitbubbles !== null) {
    const m = hbmap(charhbs)
    ctx.strokeStyle = 'black'
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'
    for (let i = 0; i < hitbubbles.length; i++) {
      const hb = hitbubbles[i]
      let x = 0
      let y = 0
      if (objHas(hb, 'x')) {
        x = hb.x
      }
      if (objHas(hb, 'y')) {
        y = hb.y
      }
      if (objHas(hb, 'follow')) {
        const hbindex = m.get(hb.follow)
        const b = charhbs[Math.abs(hbindex) - 1]
        const index = 4 * (hbindex > 0 ? b.i1 : b.i2)
        x = x + hurtbubbles[index]
        y = y + hurtbubbles[1 + index]
      }
      pathCircle(ctx, x * scale + ox, -y * scale + oy, hb.radius * scale)
      ctx.stroke()
      ctx.fill()
    }
  }

  // draw hurtbubbles
  ctx.strokeStyle = 'black'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  const bones = character.hurtbubbles
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i]
    const hb1 = bone.i1 * 4
    const hb2 = bone.i2 * 4
    pathCapsule(
      ctx,
      hurtbubbles[hb1 + 0] * scale + ox,
      -hurtbubbles[hb1 + 1] * scale + oy,
      hurtbubbles[hb2 + 0] * scale + ox,
      -hurtbubbles[hb2 + 1] * scale + oy,
      hurtbubbles[hb1 + 2] * scale,
      4
    )
    ctx.stroke()
    ctx.fill()
  }

  // draw highlight
  if (highlight >= 0) {
    ctx.strokeStyle = 'green'
    ctx.fillStyle = 'rgba(0, 255, 0, 0.25)'
    pathCircle(
      ctx,
      hurtbubbles[highlight * 4 + 0] * scale + ox,
      -hurtbubbles[highlight * 4 + 1] * scale + oy,
      hurtbubbles[highlight * 4 + 2] * scale
    )
    ctx.fill()
    ctx.stroke()
  }

  // draw active
  if (active >= 0) {
    ctx.strokeStyle = 'yellow'
    ctx.fillStyle = 'rgba(255, 255, 0, 0.33)'
    pathCircle(
      ctx,
      hurtbubbles[active * 4 + 0] * scale + ox,
      -hurtbubbles[active * 4 + 1] * scale + oy,
      hurtbubbles[active * 4 + 2] * scale
    )
    ctx.fill()
    ctx.stroke()
  }

  // draw hitbubble connections to hurtbubbles
  ctx.strokeStyle = 'rgba(100, 0, 0, 1)'
  if (hitbubbles !== null) {
    const m = hbmap(character.hurtbubbles)
    for (let i = 0; i < hitbubbles.length; i++) {
      const hb = hitbubbles[i]
      if (objHas(hb, 'follow')) {
        let x = 0
        let y = 0
        if (objHas(hb, 'x')) {
          x = hb.x
        }
        if (objHas(hb, 'y')) {
          y = hb.y
        }
        const hbindex = m.get(hb.follow)
        const b = charhbs[Math.abs(hbindex) - 1]
        const index = 4 * (hbindex > 0 ? b.i1 : b.i2)
        x = x + hurtbubbles[index]
        y = y + hurtbubbles[1 + index]

        ctx.beginPath()
        ctx.moveTo(x * scale + ox, -y * scale + oy)
        ctx.lineTo(
          hurtbubbles[index] * scale + ox,
          -hurtbubbles[1 + index] * scale + oy
        )
        ctx.stroke()
        pathCircle(ctx, x * scale + ox, -y * scale + oy, 3, 6)
        ctx.stroke()
      }
    }
  }

  // draw highlight guide lines
  if (highlight >= 0) {
    const x = hurtbubbles[highlight * 4 + 0] * scale + ox
    const y = -hurtbubbles[highlight * 4 + 1] * scale + oy
    // const r = hurtbubbles[highlight * 4 + 2] * scale
    if (hurtbubbles[highlight * 4 + 1] === 0) {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.6)'
    } else {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.2)'
    }
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()

    if (hurtbubbles[highlight * 4 + 0] === 0) {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.6)'
    } else {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.2)'
    }
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
}
const handleCopyFromEnd = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  element: HTMLButtonElement
) => () => {}
const handleSwapPrevious = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const temp = animation.keyframes[keyframe]
  animation.keyframes[keyframe] = animation.keyframes[keyframe - 1]
  animation.keyframes[keyframe - 1] = temp
  loadAnimation(character, animation)
  showEditor(character, animation, keyframe - 1, previewUpdate[keyframe - 1])
}
const handleCopyToPrevious = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const fromKF = animation.keyframes[keyframe].hurtbubbles
  const toKF = animation.keyframes[keyframe - 1].hurtbubbles
  for (let i = 0; i < fromKF.length && i < toKF.length; i++) {
    toKF[i] = fromKF[i]
  }
  loadAnimation(character, animation)
}
const handleInsertBefore = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const kf = animation.keyframes[keyframe]
  const newKeyframe: Keyframe = {
    duration: kf.duration,
    hurtbubbles: null,
  }
  if (objHas(kf, 'hurtbubbles')) {
    newKeyframe.hurtbubbles = Array.from(kf.hurtbubbles)
  }
  animation.keyframes.splice(keyframe, 0, newKeyframe)
  loadAnimation(character, animation)
  showEditor(character, animation, keyframe, previewUpdate[keyframe])
}
const handleRemoveKeyframe = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  animation.keyframes.splice(keyframe, 1)
  loadAnimation(character, animation)
}
const handleCopyFromEditor = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const fromKF = editing.animation.keyframes[editing.keyframe].hurtbubbles
  const toKF = animation.keyframes[keyframe].hurtbubbles
  for (let i = 0; i < fromKF.length && i < toKF.length; i++) {
    toKF[i] = fromKF[i]
  }
  loadAnimation(character, animation)
  showEditor(character, animation, keyframe, previewUpdate[keyframe])
}
const handleInsertAfter = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const kf = animation.keyframes[keyframe]
  const newKeyframe: Keyframe = {
    duration: kf.duration,
    hurtbubbles: null,
  }
  if (objHas(kf, 'hurtbubbles')) {
    newKeyframe.hurtbubbles = Array.from(kf.hurtbubbles)
  }
  animation.keyframes.splice(keyframe + 1, 0, newKeyframe)
  loadAnimation(character, animation)
  showEditor(character, animation, keyframe + 1, previewUpdate[keyframe + 1])
}
const handleCopyFromStart = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  element: HTMLButtonElement
) => () => {}
const handleCopyToNext = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const fromKF = animation.keyframes[keyframe].hurtbubbles
  const toKF = animation.keyframes[keyframe + 1].hurtbubbles
  for (let i = 0; i < fromKF.length && i < toKF.length; i++) {
    toKF[i] = fromKF[i]
  }
  loadAnimation(character, animation)
}
const handleSwapNext = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => () => {
  const temp = animation.keyframes[keyframe]
  animation.keyframes[keyframe] = animation.keyframes[keyframe + 1]
  animation.keyframes[keyframe + 1] = temp
  loadAnimation(character, animation)
  showEditor(character, animation, keyframe + 1, previewUpdate[keyframe + 1])
}
const keyframeCopier = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => {
  const div = document.createElement('div')
  const insertBefore = document.createElement('button')
  const insertAfter = document.createElement('button')
  const removeKeyframe = document.createElement('button')
  const copyFromEditor = document.createElement('button')

  if (keyframe === 0) {
    const copyFromEnd = document.createElement('button')
    copyFromEnd.appendChild(document.createTextNode('>v'))
    copyFromEnd.title = 'copy from end'
    copyFromEnd.addEventListener(
      'click',
      handleCopyFromEnd(character, animation, keyframe, copyFromEnd)
    )
    div.appendChild(copyFromEnd)
  } else {
    const swapPrevious = document.createElement('button')
    swapPrevious.appendChild(document.createTextNode('<'))
    swapPrevious.title = 'move left'
    swapPrevious.addEventListener(
      'click',
      handleSwapPrevious(character, animation, keyframe)
    )
    div.appendChild(swapPrevious)
  }
  insertBefore.appendChild(document.createTextNode('<<'))
  insertBefore.title = 'clone left'
  insertBefore.addEventListener(
    'click',
    handleInsertBefore(character, animation, keyframe)
  )
  div.appendChild(insertBefore)
  copyFromEditor.appendChild(document.createTextNode('v'))
  copyFromEditor.title = 'copy from editor'
  copyFromEditor.addEventListener(
    'click',
    handleCopyFromEditor(character, animation, keyframe)
  )
  div.appendChild(copyFromEditor)
  removeKeyframe.appendChild(document.createTextNode('x'))
  removeKeyframe.title = 'remove keyframe'
  removeKeyframe.addEventListener(
    'click',
    handleRemoveKeyframe(character, animation, keyframe)
  )
  div.appendChild(removeKeyframe)
  insertAfter.appendChild(document.createTextNode('>>'))
  insertAfter.title = 'clone right'
  insertAfter.addEventListener(
    'click',
    handleInsertAfter(character, animation, keyframe)
  )
  div.appendChild(insertAfter)
  if (keyframe === animation.keyframes.length - 1) {
    const copyFromStart = document.createElement('button')
    copyFromStart.appendChild(document.createTextNode('v<'))
    copyFromStart.title = 'copy from start'
    copyFromStart.addEventListener(
      'click',
      handleCopyFromStart(character, animation, keyframe, copyFromStart)
    )
    div.appendChild(copyFromStart)
  } else {
    const swapNext = document.createElement('button')
    swapNext.appendChild(document.createTextNode('>'))
    swapNext.title = 'move right'
    swapNext.addEventListener(
      'click',
      handleSwapNext(character, animation, keyframe)
    )
    div.appendChild(swapNext)
  }

  return div
}
const previewUpdate = [] as (() => void)[]
const bubblePreview = (
  character: EntityData,
  animation: Animation,
  keyframe: number
) => {
  const div = document.createElement('div')
  const kf = animation.keyframes[keyframe]
  let hitbubbles: Hitbubble[] = null
  if (objHas(kf, 'hitbubbles')) {
    let ckf = kf
    let hbkf = keyframe
    while (ckf.hitbubbles === true) {
      // find last reference to hitbubbles
      hbkf--
      ckf = animation.keyframes[hbkf]
    }
    hitbubbles = ckf.hitbubbles
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const scale = 1
  const update = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintBubbles(character, animation, keyframe, ctx, 0, 0.25, 100, 100, scale)
  }
  canvas.addEventListener('click', () =>
    showEditor(character, animation, keyframe, update)
  )
  canvas.width = 100
  canvas.height = 100
  canvas.style.width = '100px'
  canvas.style.height = '100px'
  update()
  previewUpdate.push(update)
  div.appendChild(canvas)
  return div
}
const editorDiv = document.createElement('div')
let editorHurtbubbles: HTMLDivElement = null
let editorCanvas: HTMLCanvasElement = null
let editorCtx: CanvasRenderingContext2D = null
let playerCanvas: HTMLCanvasElement = null
let playerCtx: CanvasRenderingContext2D = null
let loadedAnimation: Animation = null
const loadAnimation = (character: EntityData, anim: Animation) => {
  const animDiv = makePropDisplay(anim)
  const statDiv = makeStatDisplay(anim)

  clearUI()
  previewUpdate.length = 0
  editing.bubble = -1
  keyframesElement.appendChild(animDiv)
  keyframesElement.appendChild(statDiv)
  keyframesElement.appendChild(editorDiv)

  loadedAnimation = anim
  if (!objHas(anim, 'keyframes')) {
    return
  }
  const keyframes = anim.keyframes
  for (let i = 0; i < keyframes.length; i++) {
    const props = makePropDisplay(keyframes[i], true)
    if (objHas(keyframes[i], 'hurtbubbles')) {
      props.insertBefore(bubblePreview(character, anim, i), props.firstChild)
    }
    props.insertBefore(keyframeCopier(character, anim, i), props.firstChild)
    bubblesElement.appendChild(props)
  }
}

const populateSelect = (select: HTMLSelectElement, options: string[]) => {
  while (select.options.length > 0) {
    select.options.remove(0)
  }
  for (let i = 0; i < options.length; i++) {
    const option = document.createElement('option')
    option.text = options[i]
    select.add(option)
  }
}

let filesElement = null as HTMLSelectElement;
let animationsElement = null as HTMLSelectElement;
let initialized = false
let character: EntityData = null
let animFile = ''
let parsed: AnimationMap = null
const save = () => {
  if (animFile === '') {
    return
  }

  const s
    = JSON.stringify(parsed, null, '  ').replace(
      /("hurtbubbles": \[\n)([^\]]*)(\n\s*\])/gm,
      (_, ...b) => {
        const s = b[1].replace(
          /(\s+[\d.-]+),\n\s+([\d.-]+),\n\s+([\d.-]+),\n\s+([\d.-]+,?)/g,
          '$1, $2, $3, $4'
        )
        return b[0] + s + b[2]
      }
    ) + '\n'
    fs.writeFileSync(path.resolve(characterDir, animFile), s, {
    encoding: 'utf8',
  })
}

const start = () => {
  if (!initialized) {
    initialized = true

    editorHurtbubbles = document.createElement('div')
    editorHurtbubbles.className = 'edit-hurtbubbles'
    // editorHurtbubbles.addEventListener
    editorDiv.appendChild(editorHurtbubbles)

    editorCanvas = document.createElement('canvas')
    editorCanvas.width = 300
    editorCanvas.height = 200
    editorCanvas.style.width = '300px'
    editorCanvas.style.height = '200px'
    editorDiv.appendChild(editorCanvas)
    editorCtx = editorCanvas.getContext('2d')
    editorCanvas.addEventListener('mousedown', downEditor)
    editorCanvas.addEventListener('mousemove', moveEditor)
    editorCanvas.addEventListener('mouseup', upEditor)
    editorCanvas.addEventListener('dblclick', e => {
      e.preventDefault()
      return false
    })
    editorCanvas.addEventListener('selectstart', e => {
      e.preventDefault()
      return false
    })
    editorCanvas.addEventListener('keydown', keydownEditor)
    editorCanvas.addEventListener('keyup', keyupEditor)
    editorCanvas.style.cursor = 'default'
    editorCanvas.tabIndex = 0

    playerCanvas = document.createElement('canvas')
    playerCanvas.width = 300
    playerCanvas.height = 200
    playerCanvas.style.width = '300px'
    playerCanvas.style.height = '200px'
    editorDiv.appendChild(playerCanvas)
    playerCtx = playerCanvas.getContext('2d')

    const dirFiles = ['[File]'].concat(
      Array.from(characterData.keys())
        .filter((file: string) => !file.includes('_'))
        .sort() as any
    )

    populateSelect(filesElement, dirFiles)

    filesElement.addEventListener('change', () => {
      if (filesElement.selectedIndex === 0) {
        return
      }
      // parse file...
      const file = filesElement.value
      animFile = `${file.split('.')[0]}_anim.json`
      character = JSONC.parse(characterData.get(file).content) as EntityData
      if (characterData.has(animFile)) {
        parsed = JSONC.parse(characterData.get(animFile).content)
        console.log('Animation data is window.parsed')
        global['parsed'] = parsed
        const anims = Object.getOwnPropertyNames(parsed)
        anims.sort()
        populateSelect(animationsElement, anims)
      } else {
        populateSelect(animationsElement, [])
      }
    })
    animationsElement.addEventListener('change', () => {
      loadAnimation(character, parsed[animationsElement.value])
    })
    watchCharacters((name: string) => {
      console.log('animator reloading', name)
    })
  }
}

export const Tools = {
  *iterateKeyframes(): Generator<Keyframe, void, void> {
    for (const a of Object.getOwnPropertyNames(parsed)) {
      for (const kf of parsed[a].keyframes) {
        yield kf
      }
    }
  },
  *iterateCurrentKeyframes(): Generator<Keyframe, void, void> {
    for (const kf of loadedAnimation.keyframes) {
      yield kf
    }
  },
  *iterateAnimations(): Generator<Keyframe, void, void> {
    for (const a of Object.getOwnPropertyNames(parsed)) {
      yield parsed[a] as any
    }
  },
  *insertBubble(index = -1): Generator<[Keyframe, number[]], void, void> {
    const j = index * 4
    if (index < 0) {
      return
    }
    for (const kf of Tools.iterateKeyframes()) {
      if (!kf.hurtbubbles || !Array.isArray(kf.hurtbubbles)) {
        continue
      }
      const slice = [0, 0, 0, 0]
      yield [kf, slice]
      kf.hurtbubbles.splice(j, 0, ...slice)
    }
  },
  deleteBubble(index = -1): void {
    const j = index * 4
    if (index < 0) {
      return
    }
    for (const kf of Tools.iterateKeyframes()) {
      if (!kf.hurtbubbles || !Array.isArray(kf.hurtbubbles)) {
        continue
      }
      kf.hurtbubbles.splice(j, 4)
    }
  },
  // *iterateBubbles(bubble = -1): Generator<[number, [number, number, number, string]], void, void> {
  //   for (const kf of Tools.iterateKeyframes()) {
  //     if (!kf.hurtbubbles || !Array.isArray(kf.hurtbubbles)) {
  //       continue
  //     }
  //     for (let i = 0; i < kf.hurtbubbles.length; i = i + 4) {
  //       if (bubble !== -1 && i !== bubble * 4) {
  //         continue
  //       }
  //       const slice = kf.hurtbubbles.slice(i, i + 4)
  //       yield [i / 4, slice]
  //       // copy changes back in
  //       for (let j = 0; j < 4; j++) {
  //         kf.hurtbubbles[j + i] = slice[j]
  //       }
  //     }
  //   }
  // },
  // *iterateCurrentBubbles(bubble = -1): Generator<[number, [number, number, number, string]], void, void> {
  //   for (const kf of Tools.iterateCurrentKeyframes()) {
  //     if (!kf.hurtbubbles || !Array.isArray(kf.hurtbubbles)) {
  //       continue
  //     }
  //     for (let i = 0; i < kf.hurtbubbles.length; i = i + 4) {
  //       if (bubble !== -1 && i !== bubble * 4) {
  //         continue
  //       }
  //       const slice = kf.hurtbubbles.slice(i, i + 4)
  //       yield [i / 4, slice]
  //       // copy changes back in
  //       for (let j = 0; j < 4; j++) {
  //         kf.hurtbubbles[j + i] = slice[j]
  //       }
  //     }
  //   }
  // },
  save,
}

export const init = () => {
  keyframesElement = document.getElementById('keyframes') as HTMLElement
  bubblesElement = document.getElementById('bubbles') as HTMLElement
  filesElement = document.getElementById('files') as HTMLSelectElement
  animationsElement = document.getElementById(
    'animations'
  ) as HTMLSelectElement

  document.getElementById('save_button').addEventListener('click', save)

  start()
}

console.log('find tools at window.tools')
global['Tools'] = Tools
