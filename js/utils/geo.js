/**
 * Verifica se dois bounding boxes se intersectam.
 * @param {number[]} a - [minX, minY, maxX, maxY]
 * @param {number[]} b - [minX, minY, maxX, maxY]
 */
export function bboxIntersects([ax0, ay0, ax1, ay1], [bx0, by0, bx1, by1]) {
  return !(ax1 < bx0 || ax0 > bx1 || ay1 < by0 || ay0 > by1);
}