type MenuNode = { id:string; label:string; children?: {id:string;label:string}[] }
/** Match a parent by name or individual children; do not mutate the menu. */
export function filterStudentMenu<T extends MenuNode>(items: T[], query: string): T[] {
  const key=query.trim().toLocaleLowerCase()
  if(!key)return items
  return items.flatMap(item=>{
    if(item.label.toLocaleLowerCase().includes(key))return [item]
    const children=item.children?.filter(child=>child.label.toLocaleLowerCase().includes(key))
    return children?.length ? [{...item,children} as T] : []
  })
}
