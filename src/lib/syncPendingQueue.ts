/** Merge a failed batch back behind edits made while it was in flight.
 * A newer write or deletion always wins over the failed older operation. */
export function restoreFailedSync(
 currentStores:Record<string,string>, currentDeleted:Set<string>,
 failedStores:Record<string,string>, failedDeleted:readonly string[],
):void {
 for (const [key,value] of Object.entries(failedStores)) {
  if (!Object.prototype.hasOwnProperty.call(currentStores,key) && !currentDeleted.has(key)) currentStores[key]=value
 }
 for (const key of failedDeleted) {
  if (!Object.prototype.hasOwnProperty.call(currentStores,key) && !currentDeleted.has(key)) currentDeleted.add(key)
 }
}
