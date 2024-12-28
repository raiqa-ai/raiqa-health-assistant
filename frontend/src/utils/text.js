const normalizeText = (text) => {
  if (!text) return '';
  
  // Remove any null bytes and normalize whitespace
  const cleaned = text
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Encode special characters while preserving readability
  return encodeURIComponent(cleaned);
};

const denormalizeText = (text) => {
  if (!text) return '';
  try {
    return decodeURIComponent(text);
  } catch (e) {
    console.error('Error decoding text:', e);
    return text;
  }
};

module.exports = {
  normalizeText,
  denormalizeText
};
