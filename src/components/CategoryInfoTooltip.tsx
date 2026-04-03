import React from 'react'
import { getCategoryHelp } from '../data/overviewCategoryInfo'
import HoverInfoTooltip from './HoverInfoTooltip'

interface Props {
  categoryName: string
}

export default function CategoryInfoTooltip({ categoryName }: Props) {
  const help = getCategoryHelp(categoryName)
  if (!help) return null

  return (
    <HoverInfoTooltip
      ariaLabel={categoryName}
      whatInside={help.contains}
      ifYouDelete={help.impact}
    />
  )
}
