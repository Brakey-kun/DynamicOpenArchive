export const getContrastingColor = (hex: string) => {
    let sanitizedHex = hex.replace('#', '');
    if (sanitizedHex.length === 3) {
        sanitizedHex = sanitizedHex.split('').map(char => char + char).join('');
    }
    const r = parseInt(sanitizedHex.substr(0, 2), 16) || 0;
    const g = parseInt(sanitizedHex.substr(2, 2), 16) || 0;
    const b = parseInt(sanitizedHex.substr(4, 2), 16) || 0;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    // 128 is a common threshold. We'll return black for light backgrounds, white for dark.
    return (yiq >= 128) ? '#111827' : '#ffffff';
};
