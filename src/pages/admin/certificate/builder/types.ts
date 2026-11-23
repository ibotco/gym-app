/** Palette categories shown in the builder's element palette. */
export type CertPaletteGroup = 'database' | 'textbase' | 'media' | 'shapes'

export type CertElementType = 'logo' | 'image' | 'badge' | 'heading' | 'text' | 'student_name' | 'course' | 'date' | 'signature' | 'signature_line' | 'seal' | 'subject_table' | 'rectangle' | 'square' | 'circle' | 'border' | 'line'

export type CertElement = {
  id: string
  type: CertElementType
  x: number
  y: number
  w: number
  h: number
  content: string
  group?: CertPaletteGroup
  source?: string
  style: {
    fontFamily: string
    fontSize: number
    color: string
    textAlign: 'left' | 'center' | 'right'
    fontWeight: string
    fontStyle: string
    backgroundColor?: string
    borderWidth?: number
    borderColor?: string
    borderRadius?: number
    lineHeight?: number
  }
}

export type CustomDbVar = {
  id: string
  label: string
  key: string
  defaultContent: string
  source: string
}

export type CertPaletteItem = {
  type: CertElementType
  label: string
  defaultContent: string
  group: CertPaletteGroup
}

export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom'
export type Orientation = 'Landscape' | 'Portrait'
export type MarginFilter = 'None' | 'Small' | 'Medium' | 'Large' | 'Extra Large'
export type BgPattern = 'none' | 'dots' | 'lines' | 'grid' | 'waves' | 'chevron' | 'stripes' | 'crosshatch' | 'confetti' | 'damask' | 'stars' | 'marble' | 'honeycomb' | 'herringbone' | 'paisley' | 'floral' | 'geometric' | 'mosaic' | 'linen' | 'parchment' | 'bubbles' | 'diagonal' | 'zigzag' | 'circles' | 'hexagons' | 'noise' | 'vintage-paper'
export type BorderStyle = 'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge' | 'ornate' | 'vintage' | 'elegant' | 'classic' | 'modern' | 'gold' | 'silver' | 'floral' | 'thick' | 'striped' | 'royal' | 'emerald' | 'burgundy' | 'navy-gold' | 'art-deco' | 'wavy' | 'scalloped' | 'rope' | 'laurel' | 'shadow' | 'triple' | 'mosaic' | 'inset' | 'outset' | 'bevel'
export type HolderType = 'Student' | 'Employee' | 'Member' | 'All'
