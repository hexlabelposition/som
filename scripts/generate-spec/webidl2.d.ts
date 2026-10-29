// webidl2 ships no types. Only the part the generator uses is declared.
declare module "webidl2" {
  export interface IdlType {
    idlType: string | IdlType[];
  }

  export interface Member {
    type: string;
    name: string;
    idlType: IdlType;
  }

  export interface Definition {
    type: string;
    name: string;
    partial?: boolean;
    inheritance?: string | null;
    members?: Member[];
    target?: string;
    includes?: string;
  }

  export function parse(text: string): Definition[];
}
