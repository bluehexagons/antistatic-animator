import { getRuntimeRequire } from './require'

const runtimeRequire = getRuntimeRequire('Node fs')
const fs = runtimeRequire('fs') as typeof import('fs')

export default fs
