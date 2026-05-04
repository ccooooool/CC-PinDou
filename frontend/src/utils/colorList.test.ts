import { describe, it, expect } from 'vitest'
import { recalculateColorList } from './colorList'
import type { GridCell } from '../types/perler'

function makeGrid(colors: string[][]): GridCell[][] {
  return colors.map((row, y) =>
    row.map((color, x) => ({
      color,
      codes: { MARD: `A${x}${y}` },
      x,
      y,
    }))
  )
}

describe('recalculateColorList', () => {
  it('should count colors correctly', () => {
    const grid = makeGrid([
      ['#ff0000', '#ff0000', '#00ff00'],
      ['#00ff00', '#0000ff', '#0000ff'],
    ])
    const result = recalculateColorList(grid)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ hex: '#ff0000', count: 2 })
    expect(result[1]).toMatchObject({ hex: '#00ff00', count: 2 })
    expect(result[2]).toMatchObject({ hex: '#0000ff', count: 2 })
  })

  it('should skip transparent cells', () => {
    const grid = makeGrid([
      ['#ff0000', 'transparent'],
      ['transparent', '#ff0000'],
    ])
    const result = recalculateColorList(grid)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ hex: '#ff0000', count: 2 })
  })

  it('should preserve codes from first occurrence', () => {
    const grid = makeGrid([
      ['#ff0000', '#ff0000'],
    ])
    grid[0][0].codes = { MARD: 'A01' }
    grid[0][1].codes = { MARD: 'A02' }
    const result = recalculateColorList(grid)
    expect(result[0].codes).toEqual({ MARD: 'A01' })
  })

  it('should return empty array for all-transparent grid', () => {
    const grid = makeGrid([
      ['transparent', 'transparent'],
    ])
    const result = recalculateColorList(grid)
    expect(result).toHaveLength(0)
  })
})
