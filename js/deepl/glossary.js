/**
 * @fileoverview DeepL Glossary management utilities
 * Extract glossary entries from translation CSV files
 */

/**
 * Parse CSV content to extract glossary entries
 * Extracts Chinese -> Korean mappings for DeepL Glossary
 * @param {string} csvContent - Raw CSV content
 * @returns {Array<{source: string, target: string}>} Glossary entries
 */
export function parseGlossaryFromCSV(csvContent) {
  const entries = [];
  const lines = csvContent.split("\n");

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted fields)
    const fields = parseCSVLine(line);
    if (fields.length < 4) continue;

    const [type, category, key, korean] = fields;

    // Only process Common type entries (term mappings)
    // Skip Override entries (item-specific translations)
    if (type !== "Common") continue;

    // Skip if key or korean is empty
    if (!key || !korean) continue;

    // Skip numeric IDs (like 17310010001)
    if (/^\d+$/.test(key)) continue;

    // Skip if key contains HTML or special markers
    if (key.includes("<") || key.includes(">")) continue;

    // Skip if korean is same as key
    if (key === korean) continue;

    // Add entry
    entries.push({
      source: key.trim(),
      target: korean.trim(),
    });
  }

  // Remove duplicates (keep first occurrence)
  const seen = new Set();
  const uniqueEntries = [];
  for (const entry of entries) {
    if (!seen.has(entry.source)) {
      seen.add(entry.source);
      uniqueEntries.push(entry);
    }
  }

  return uniqueEntries;
}

/**
 * Parse a CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]} Parsed fields
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields;
}

/**
 * Convert glossary entries to DeepL TSV format
 * @param {Array<{source: string, target: string}>} entries - Glossary entries
 * @returns {string} TSV formatted string
 */
export function entriesToTSV(entries) {
  return entries.map((e) => `${e.source}\t${e.target}`).join("\n");
}

/**
 * Load and merge glossary from translation CSV files
 * @returns {Promise<Array<{source: string, target: string}>>} Combined glossary entries
 */
export async function loadGlossaryFromCSVs() {
  const entries = [];

  try {
    // Load translation.csv
    const response1 = await fetch("./translation.csv");
    if (response1.ok) {
      const csv1 = await response1.text();
      entries.push(...parseGlossaryFromCSV(csv1));
    }

    // Load translation2.csv
    const response2 = await fetch("./translation2.csv");
    if (response2.ok) {
      const csv2 = await response2.text();
      entries.push(...parseGlossaryFromCSV(csv2));
    }
  } catch (error) {
    console.error("[Glossary] Failed to load CSVs:", error);
  }

  // Remove duplicates (keep first occurrence)
  const seen = new Set();
  const uniqueEntries = [];
  for (const entry of entries) {
    if (!seen.has(entry.source)) {
      seen.add(entry.source);
      uniqueEntries.push(entry);
    }
  }

  console.log(`[Glossary] Loaded ${uniqueEntries.length} entries`);
  return uniqueEntries;
}

/**
 * DeepL Glossary API wrapper
 */
export class DeepLGlossary {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
    this.glossaryId = null;
    this.glossaryName = "wwmmap_zh_ko";
  }

  /**
   * Create or update glossary on DeepL
   * @param {string} encryptedKey - Encrypted API key
   * @param {number} timestamp - Encryption timestamp
   * @param {Array<{source: string, target: string}>} entries - Glossary entries
   * @returns {Promise<{success: boolean, glossaryId?: string, error?: string}>}
   */
  async createGlossary(encryptedKey, timestamp, entries) {
    try {
      const response = await fetch(
        `${this.backendUrl}/api/deepl/glossary/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            k: encryptedKey,
            t: timestamp,
            name: this.glossaryName,
            sourceLang: "ZH",
            targetLang: "KO",
            entries: entriesToTSV(entries),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || data.error };
      }

      this.glossaryId = data.glossaryId;
      return { success: true, glossaryId: data.glossaryId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List user's glossaries
   * @param {string} encryptedKey - Encrypted API key
   * @param {number} timestamp - Encryption timestamp
   * @returns {Promise<{success: boolean, glossaries?: Array, error?: string}>}
   */
  async listGlossaries(encryptedKey, timestamp) {
    try {
      const response = await fetch(
        `${this.backendUrl}/api/deepl/glossary/list`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ k: encryptedKey, t: timestamp }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || data.error };
      }

      // Find our glossary
      const ourGlossary = data.glossaries?.find(
        (g) => g.name === this.glossaryName
      );
      if (ourGlossary) {
        this.glossaryId = ourGlossary.glossary_id;
      }

      return { success: true, glossaries: data.glossaries };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a glossary
   * @param {string} encryptedKey - Encrypted API key
   * @param {number} timestamp - Encryption timestamp
   * @param {string} glossaryId - Glossary ID to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteGlossary(encryptedKey, timestamp, glossaryId) {
    try {
      const response = await fetch(
        `${this.backendUrl}/api/deepl/glossary/delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            k: encryptedKey,
            t: timestamp,
            glossaryId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || data.error };
      }

      if (glossaryId === this.glossaryId) {
        this.glossaryId = null;
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current glossary ID
   * @returns {string|null}
   */
  getGlossaryId() {
    return this.glossaryId;
  }
}
