const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element with the given tag name
 * @param tagName - SVG element tag name
 * @param attributes - Attributes to set on the element
 * @returns Created SVG element
 */
export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
  attributes?: Record<string, string | number>
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tagName);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
  }
  return element;
}

/**
 * Create an SVG root element with viewBox
 * @param viewBox - ViewBox as [minX, minY, width, height]
 * @param width - Optional CSS width
 * @param height - Optional CSS height
 * @returns Created SVG element
 */
export function createSvg(
  viewBox: [number, number, number, number],
  width?: number | string,
  height?: number | string
): SVGSVGElement {
  const svg = createSvgElement('svg', {
    viewBox: viewBox.join(' '),
  });
  if (width !== undefined) {
    svg.setAttribute('width', String(width));
  }
  if (height !== undefined) {
    svg.setAttribute('height', String(height));
  }
  return svg;
}

/**
 * Create a path element
 * @param d - Path data string
 * @param attributes - Additional attributes
 * @returns Created path element
 */
export function createPath(
  d: string,
  attributes?: Record<string, string | number>
): SVGPathElement {
  return createSvgElement('path', { d, ...attributes });
}

/**
 * Create a line element
 * @param x1 - Start x coordinate
 * @param y1 - Start y coordinate
 * @param x2 - End x coordinate
 * @param y2 - End y coordinate
 * @param attributes - Additional attributes
 * @returns Created line element
 */
export function createLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attributes?: Record<string, string | number>
): SVGLineElement {
  return createSvgElement('line', { x1, y1, x2, y2, ...attributes });
}

/**
 * Create a group element
 * @param attributes - Attributes to set on the group
 * @returns Created group element
 */
export function createGroup(
  attributes?: Record<string, string | number>
): SVGGElement {
  return createSvgElement('g', attributes);
}
