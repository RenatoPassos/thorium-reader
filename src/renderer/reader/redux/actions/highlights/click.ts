// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { IHighlight } from "@r2-navigator-js/electron/common/highlight";
import { Action } from "readium-desktop/common/models/redux";

export const ID = "READER_HIGHLIGHT_CLICK";

// tslint:disable-next-line: no-empty-interface
interface IPayload {
    href: string;
    ref: IHighlight;
}

export function build(data: IPayload):
    Action<typeof ID, IPayload> {

    return {
        type: ID,
        payload: data,
    };
}
build.toString = () => ID; // Redux StringableActionCreator
export type TAction = ReturnType<typeof build>;