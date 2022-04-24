import * as fs from 'fs'

export type Dictionary = {[s: string]: any}

export type SegmentHandler = (from: number, to: number) => void

export const appDir = `${process.cwd()}/../../antistatic/`
export const debugMode = !!fs.existsSync(appDir + 'debug')

console.log('`./debug` found?', debugMode)

export const objHas = (o: {}, prop: string | number | symbol) => Object.prototype.hasOwnProperty.call(o, prop)

export const map = <T = any>(o: {[key: string]: T}): Map<string, T> => {
  if (!o) {
    return new Map()
  }
  const keys = Object.keys(o)
  const m = new Map()
  for (const key of keys) {
    m.set(key, o[key])
  }
  return m
}

export const mapToObject = (m: Map<string, any>) => {
  const o: {[s: string]: any} = {}
  for (const [k, v] of m) {
    o[k] = v
  }
  return o
}

export const readDir = (dir: string) => {
  const dirFiles = fs.readdirSync(appDir + dir)
  const fileMap = new Map<string, string>()
  if (!dirFiles) {
    console.error('Falsy dirFiles:', dirFiles)
  }
  for (let i = 0; i < dirFiles.length; i++) {
    const f = dirFiles[i]
    fileMap.set(f, fs.readFileSync(`${appDir + dir}/${f}`, 'utf8'))
  }
  return fileMap
}

export class WatchedFile {
  content: string
  filename: string
  watchers: ((watcher: WatchedFile) => void)[] = []

  constructor(file: string) {
    this.filename = file
    this.content = fs.readFileSync(file, 'utf8')

    try {
      fs.watch(file, (_event, filename) => {
        const content = fs.readFileSync(file, 'utf8')
        console.log('file updated', filename)
        if (!content) {
          console.log('No content, ignoring')
          return
        }
        if (this.content === content) {
          console.log('Content unchanged, ignoring')
          return
        }
        this.content = content
        for (let i = 0; i < this.watchers.length; i++) {
          console.log('dispatched to watcher', i)
          this.watchers[i](this)
        }
      })
    } catch (e) {
      console.warn('unable to watch file:', e)
    }
  }

  watch(callback: (watcher: WatchedFile) => void) {
    // console.log('watching', this.filename)
    this.watchers.push(callback)
  }

  unwatch(callback: (watcher: WatchedFile) => void) {
    if (!this.watchers.includes(callback)) {
      return
    }
    this.watchers.splice(this.watchers.indexOf(callback), 1)
  }
}

export const watchDir = (dir: string) => {
  const dirFiles = fs.readdirSync(appDir + dir)
  const fileMap = new Map<string, WatchedFile>()
  if (!dirFiles) {
    console.error('Falsy dirFiles:', dirFiles)
  }
  for (let i = 0; i < dirFiles.length; i++) {
    const f = dirFiles[i]
    fileMap.set(f, new WatchedFile(`${appDir + dir}/${f}`))
  }
  return fileMap
}

export const characterDir = 'app/characters/data'
export const characterData = watchDir(characterDir)
const watchers = [] as ((name: string) => void)[]

export const watchCharacters = (callback: (name: string) => void) => {
  console.log('character watching enabled')
  watchers.push(callback)
}

export const getCharacterFiles = (name: string, ...files: string[]) => {
  const f: WatchedFile[] = []
  const cb = () => {
    for (let i = 0; i < watchers.length; i++) {
      watchers[i](name)
    }
  }
  for (let i = 0; i < files.length; i++) {
    if (!characterData.has(files[i])) {
      console.error('Oh no! A character file was not found:', files[i])
    }
    const w = characterData.get(files[i]) as WatchedFile
    f.push(w)
    w.watch(cb)
  }
  return f
}

export const objDiff = (a: Record<string, any>, b: Record<string, any>) => {
  const added: string[] = []
  const removed: string[] = []

  for (const key in b) {
    if (!objHas(b, key)) {
      continue
    }
    if (!objHas(a, key)) {
      added.push(key)
    }
  }

  for (const key in a) {
    if (!objHas(a, key)) {
      continue
    }
    if (!objHas(b, key)) {
      removed.push(key)
    }
  }

  return [added, removed]
}
