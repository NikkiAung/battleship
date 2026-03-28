// stub for @phala/dcap-qvl — node-only module used by the SDK's TEE verify
// we don't use DCAP quote verification in the browser
export const getCollateral = () => {
  throw new Error("dcap-qvl not available in browser");
};
export const verify = () => {
  throw new Error("dcap-qvl not available in browser");
};
export const Quote = {
  parse: () => {
    throw new Error("dcap-qvl not available in browser");
  },
};
