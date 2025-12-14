/**
 * HTML Source Mapper Utility
 *
 * Maps DOM changes back to source HTML files and performs surgical updates
 * without reformatting the entire file.
 */

/**
 * Result of finding an element in source
 */
interface ElementMatch {
  startIndex: number;
  endIndex: number;
  outerHTML: string;
  innerHTML: string;
  openTagEnd: number;  // Position after the opening tag
  closeTagStart: number;  // Position of the closing tag
}

/**
 * HTML Source Mapper - finds and updates elements in HTML source files
 */
export class HtmlSourceMapper {
  /**
   * Find an element in the HTML source by selector/xpath
   * Uses multiple strategies for reliable matching
   */
  static findElementInSource(
    htmlContent: string,
    selector: string,
    xpath?: string,
    textContent?: string
  ): ElementMatch | null {
    // Strategy 1: Find by ID (most reliable)
    const idMatch = selector.match(/#([^.\s[\]:>]+)/);
    if (idMatch) {
      const id = idMatch[1];
      const result = this.findElementById(htmlContent, id);
      if (result) return result;
    }

    // Strategy 2: Find by tag and text content
    if (textContent) {
      const tagMatch = selector.match(/^(\w+)/);
      if (tagMatch) {
        const result = this.findElementByTagAndText(htmlContent, tagMatch[1], textContent);
        if (result) return result;
      }
    }

    // Strategy 3: Find by unique class combination
    const classMatch = selector.match(/\.([^.\s[\]:>]+)/g);
    if (classMatch && classMatch.length > 0) {
      const classes = classMatch.map(c => c.substring(1));
      const tagMatch = selector.match(/^(\w+)/);
      const tag = tagMatch ? tagMatch[1] : null;
      const result = this.findElementByClasses(htmlContent, classes, tag, textContent);
      if (result) return result;
    }

    // Strategy 4: Parse xpath for structure hints
    if (xpath) {
      const result = this.findElementByXpathHeuristic(htmlContent, xpath, textContent);
      if (result) return result;
    }

    return null;
  }

  /**
   * Find element by ID attribute
   */
  private static findElementById(htmlContent: string, id: string): ElementMatch | null {
    // Match opening tag with this ID
    const escapedId = this.escapeRegExp(id);
    const pattern = new RegExp(
      `<(\\w+)[^>]*\\sid=["']${escapedId}["'][^>]*>`,
      'i'
    );

    const match = htmlContent.match(pattern);
    if (!match || match.index === undefined) return null;

    const tagName = match[1];
    const startIndex = match.index;

    return this.extractFullElement(htmlContent, startIndex, tagName);
  }

  /**
   * Find element by tag name and text content
   */
  private static findElementByTagAndText(
    htmlContent: string,
    tag: string,
    textContent: string
  ): ElementMatch | null {
    const normalizedText = textContent.trim().substring(0, 100);
    if (!normalizedText) return null;

    // Find all occurrences of this tag
    const tagPattern = new RegExp(`<${tag}[^>]*>`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(htmlContent)) !== null) {
      const startIndex = match.index;
      const element = this.extractFullElement(htmlContent, startIndex, tag);

      if (element) {
        // Check if the inner content contains our text
        const innerText = this.stripHtmlTags(element.innerHTML).trim();
        if (innerText.includes(normalizedText) || normalizedText.includes(innerText)) {
          return element;
        }
      }
    }

    return null;
  }

  /**
   * Find element by class combination
   */
  private static findElementByClasses(
    htmlContent: string,
    classes: string[],
    tag: string | null,
    textContent?: string
  ): ElementMatch | null {
    // Build a pattern that matches elements with all these classes
    const tagPart = tag ? tag : '\\w+';

    // Find all potential elements
    const pattern = new RegExp(`<(${tagPart})[^>]*class=["'][^"']*["'][^>]*>`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(htmlContent)) !== null) {
      const fullMatch = match[0];

      // Check if all classes are present
      const classAttr = fullMatch.match(/class=["']([^"']*)["']/i);
      if (!classAttr) continue;

      const elementClasses = classAttr[1].split(/\s+/);
      const hasAllClasses = classes.every(c => elementClasses.includes(c));

      if (hasAllClasses) {
        const startIndex = match.index;
        const element = this.extractFullElement(htmlContent, startIndex, match[1]);

        if (element) {
          // If we have text content to match, verify it
          if (textContent) {
            const innerText = this.stripHtmlTags(element.innerHTML).trim();
            const normalizedText = textContent.trim().substring(0, 100);
            if (!innerText.includes(normalizedText) && !normalizedText.includes(innerText)) {
              continue;
            }
          }
          return element;
        }
      }
    }

    return null;
  }

  /**
   * Find element using xpath structure as a hint
   */
  private static findElementByXpathHeuristic(
    htmlContent: string,
    xpath: string,
    textContent?: string
  ): ElementMatch | null {
    // Extract tag name from xpath
    const tagMatch = xpath.match(/\/([a-z0-9]+)(?:\[\d+\])?$/i);
    if (!tagMatch) return null;

    const tag = tagMatch[1];

    // If we have text content, use that for matching
    if (textContent) {
      return this.findElementByTagAndText(htmlContent, tag, textContent);
    }

    return null;
  }

  /**
   * Extract the full element including closing tag
   */
  private static extractFullElement(
    htmlContent: string,
    startIndex: number,
    tagName: string
  ): ElementMatch | null {
    // Find the end of opening tag
    const openTagEnd = htmlContent.indexOf('>', startIndex);
    if (openTagEnd === -1) return null;

    const openTag = htmlContent.substring(startIndex, openTagEnd + 1);

    // Check if it's a self-closing tag
    if (openTag.endsWith('/>') || this.isSelfClosingTag(tagName)) {
      return {
        startIndex,
        endIndex: openTagEnd + 1,
        outerHTML: openTag,
        innerHTML: '',
        openTagEnd: openTagEnd + 1,
        closeTagStart: openTagEnd + 1,
      };
    }

    // Find matching closing tag, accounting for nested tags
    const closeTagPattern = new RegExp(`</${tagName}>`, 'i');
    const openTagPattern = new RegExp(`<${tagName}[\\s>]`, 'i');

    let depth = 1;
    let searchPos = openTagEnd + 1;

    while (depth > 0 && searchPos < htmlContent.length) {
      const remainingContent = htmlContent.substring(searchPos);

      const nextOpen = remainingContent.search(openTagPattern);
      const nextClose = remainingContent.search(closeTagPattern);

      if (nextClose === -1) {
        // No closing tag found
        return null;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Found another opening tag first
        depth++;
        searchPos += nextOpen + 1;
      } else {
        // Found closing tag
        depth--;
        if (depth === 0) {
          const closeTagStart = searchPos + nextClose;
          const closeTagEnd = closeTagStart + tagName.length + 3; // </ + tagName + >

          return {
            startIndex,
            endIndex: closeTagEnd,
            outerHTML: htmlContent.substring(startIndex, closeTagEnd),
            innerHTML: htmlContent.substring(openTagEnd + 1, closeTagStart),
            openTagEnd: openTagEnd + 1,
            closeTagStart,
          };
        }
        searchPos += nextClose + 1;
      }
    }

    return null;
  }

  /**
   * Check if a tag is self-closing (void element)
   */
  private static isSelfClosingTag(tagName: string): boolean {
    const voidElements = [
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ];
    return voidElements.includes(tagName.toLowerCase());
  }

  /**
   * Update text content in HTML source
   */
  static updateTextContent(
    htmlContent: string,
    selector: string,
    xpath: string,
    oldText: string,
    newText: string
  ): string | null {
    const element = this.findElementInSource(htmlContent, selector, xpath, oldText);
    if (!element) {
      console.warn('[HtmlSourceMapper] Element not found for text update');
      return null;
    }

    // Replace the innerHTML with new text
    // This preserves the opening and closing tags
    const before = htmlContent.substring(0, element.openTagEnd);
    const after = htmlContent.substring(element.closeTagStart);

    // Preserve leading/trailing whitespace from original innerHTML
    const leadingWhitespace = element.innerHTML.match(/^(\s*)/)?.[1] || '';
    const trailingWhitespace = element.innerHTML.match(/(\s*)$/)?.[1] || '';

    const newInnerHTML = leadingWhitespace + newText.trim() + trailingWhitespace;

    return before + newInnerHTML + after;
  }

  /**
   * Update inline style in HTML source
   */
  static updateInlineStyle(
    htmlContent: string,
    selector: string,
    xpath: string,
    property: string,
    value: string,
    textContent?: string
  ): string | null {
    const element = this.findElementInSource(htmlContent, selector, xpath, textContent);
    if (!element) {
      console.warn('[HtmlSourceMapper] Element not found for style update');
      return null;
    }

    // Get the opening tag
    const openTag = htmlContent.substring(element.startIndex, element.openTagEnd);

    // Convert property to kebab-case
    const kebabProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();

    let newOpenTag: string;

    // Check if style attribute exists
    const styleMatch = openTag.match(/style=["']([^"']*)["']/);

    if (styleMatch) {
      // Update existing style attribute
      const existingStyle = styleMatch[1];
      const styleProps = this.parseStyleString(existingStyle);
      styleProps[kebabProperty] = value;
      const newStyleValue = this.buildStyleString(styleProps);

      newOpenTag = openTag.replace(
        styleMatch[0],
        `style="${newStyleValue}"`
      );
    } else {
      // Add new style attribute before the closing >
      const insertPos = openTag.lastIndexOf('>');
      newOpenTag = openTag.substring(0, insertPos) +
                   ` style="${kebabProperty}: ${value};"` +
                   openTag.substring(insertPos);
    }

    // Reconstruct the HTML
    const before = htmlContent.substring(0, element.startIndex);
    const after = htmlContent.substring(element.openTagEnd);

    return before + newOpenTag + after;
  }

  /**
   * Parse style string into object
   */
  private static parseStyleString(style: string): Record<string, string> {
    const result: Record<string, string> = {};
    const parts = style.split(';').filter(p => p.trim());

    for (const part of parts) {
      const colonIndex = part.indexOf(':');
      if (colonIndex > 0) {
        const prop = part.substring(0, colonIndex).trim();
        const val = part.substring(colonIndex + 1).trim();
        if (prop && val) {
          result[prop] = val;
        }
      }
    }

    return result;
  }

  /**
   * Build style string from object
   */
  private static buildStyleString(styles: Record<string, string>): string {
    return Object.entries(styles)
      .map(([prop, val]) => `${prop}: ${val}`)
      .join('; ') + ';';
  }

  /**
   * Strip HTML tags from string
   */
  private static stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Escape special regex characters
   */
  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
