// Global ambient type declarations to satisfy project-wide TypeScript

// Module shim for pdf-parse (typed as any)
declare module "pdf-parse" {
  const pdfParse: any;
  export default pdfParse;
}
