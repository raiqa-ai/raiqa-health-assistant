const normalizeText = (text) => {
    if (!text) return '';
    try {
      return text
        .replace(/\0/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (e) {
      console.error('Error normalizing text:', e);
      return text;
    }
  };
  
  const denormalizeText = (text) => {
    if (!text) return '';
    try {
      return text
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
    } catch (e) {
      console.error('Error denormalizing text:', e);
      return text;
    }
  };
  
  module.exports = {
    normalizeText,
    denormalizeText
  };