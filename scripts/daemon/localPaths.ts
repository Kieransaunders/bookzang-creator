export type LocalPaths = {
  txtPath: string;
  epubPath: string;
  extractedPath: string;
  derivedPath: string;
  manifestPath: string;
  exportsDir: string;
};

export function buildLocalPaths(root: string, gutenbergId: string): LocalPaths {
  return {
    txtPath: `${root}/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    epubPath: `${root}/epub/${gutenbergId}/pg${gutenbergId}.epub`,
    extractedPath: `${root}/work/${gutenbergId}/extracted/book.annotated.md`,
    derivedPath: `${root}/work/${gutenbergId}/derived/chapters.json`,
    manifestPath: `${root}/work/${gutenbergId}/manifest.json`,
    exportsDir: `${root}/work/${gutenbergId}/exports`,
  };
}
