import { getRuntimeRequire } from './require'

const runtimeRequire = getRuntimeRequire('Node path')
const path = runtimeRequire('path') as typeof import('path')

export default path
