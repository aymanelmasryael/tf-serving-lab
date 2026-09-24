/* =========================================================================
   Application State Management
   ========================================================================= */

import { createInitialState, DEFAULT_CONTRACT, DEFAULT_REQUEST, BAD_REQUEST, recompileTiming } from "../simulation/training.js";
import { parseContract } from "../contracts/parser.js";

export function createAppState() {
  const S = createInitialState();
  S.contractSrc = DEFAULT_CONTRACT;
  S.requestSrc = DEFAULT_REQUEST;
  
  let contract = parseContract(S.contractSrc);
  recompileTiming(S);
  
  return { S, contract };
}

export function setContract(appState, newContract) {
  appState.contract = newContract;
}

export function recompileContract(appState) {
  appState.contract = parseContract(appState.S.contractSrc);
  return appState.contract;
}