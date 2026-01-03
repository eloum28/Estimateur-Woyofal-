
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

export const validateInput = (val: number, allowZero: boolean = true): boolean => {
  if (isNaN(val)) return false;
  if (allowZero) return val >= 0;
  return val > 0;
};
