// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END

import * as pdfJs from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist/types/display/api";
import { Link } from "r2-shared-js/dist/es6-es2015/src/models/publication-link";
import { eventBus } from "readium-desktop/utils/eventBus";

import { IEventBusPdfPlayerMaster, IEventBusPdfPlayerSlave } from "./pdfReader.type";

// webpack.config.renderer-reader.js
pdfJs.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

type TUnPromise<T extends any> =
    T extends Promise<infer R> ? R : any;
type TReturnPromise<T extends (...args: any) => any> =
    T extends (...args: any) => Promise<infer R> ? R : any;
type TUnArray<T extends any> =
    T extends Array<infer R> ? R : any;
type TGetDocument = ReturnType<typeof pdfJs.getDocument>;
type TPdfDocumentProxy = TUnPromise<TGetDocument["promise"]>;
type TOutlineRaw = TReturnPromise<TPdfDocumentProxy["getOutline"]>;
type TOutlineUnArray = TUnArray<TOutlineRaw>;

interface TdestForPageIndex { num: number; gen: number; }
type TdestObj = { name?: string} | TdestForPageIndex | null;

interface IOutline extends Partial<TOutlineUnArray> {
    dest?: string | TdestObj[];
    items?: IOutline[];
}

function destForPageIndexParse(destRaw: any | any[]): TdestForPageIndex | undefined {

    const destArray = Array.isArray(destRaw) ? destRaw : [destRaw];

    const destForPageIndex = destArray.reduce<TdestForPageIndex | undefined>(
        (pv, cv: TdestForPageIndex) => (typeof cv?.gen === "number" && typeof cv?.num === "number") ? cv : pv,
        undefined,
    );

    return destForPageIndex;
}

async function tocOutlineItemToLink(outline: IOutline, pdf: PDFDocumentProxy): Promise<Link> {

    const link = new Link();

    if (outline.dest) {

        const destRaw = outline.dest;
        let destForPageIndex: TdestForPageIndex | undefined;

        if (typeof destRaw === "string") {
            const destArray = await pdf.getDestination(destRaw);

            destForPageIndex = destForPageIndexParse(destArray);

        } else if (typeof destRaw === "object") {
            destForPageIndex = destForPageIndexParse(destRaw);
        }

        if (destForPageIndex) {
            const page = await pdf.getPageIndex(destForPageIndex);
            link.Href = page.toString();
        }

    }

    link.Title = typeof outline.title === "string" ? outline.title : "";

    if (Array.isArray(outline.items)) {

        const itemsPromise = outline.items.map(async (item) => tocOutlineItemToLink(item, pdf));
        link.Children = await Promise.all(itemsPromise);
    }

    return link;
}

export async function pdfReaderMountingPoint(
    rootElement: HTMLDivElement,
    pdfPath: string,
): Promise<IEventBusPdfPlayerSlave> {

    const { slave, master } = eventBus() as { master: IEventBusPdfPlayerMaster, slave: IEventBusPdfPlayerSlave };

    const canvas = document.createElement("canvas");
    rootElement.appendChild(canvas);

    canvas.width = rootElement.clientWidth;
    canvas.height = rootElement.clientHeight;

    const pdf = await pdfJs.getDocument(pdfPath).promise;

    const outline: IOutline[] = await pdf.getOutline();
    let toc: Link[] = [];

    try {
        if (Array.isArray(outline)) {
            const tocPromise = outline.map((item) => tocOutlineItemToLink(item, pdf));
            toc = await Promise.all(tocPromise);
        }
    } catch (e) {

        console.error("Error to converte outline to toc link");
        console.error(e);

        toc = [];
    }

    console.log("outline", outline);
    // console.log(await pdf.getDestination("p14"));
    // console.log(await pdf.getPageIndex((await pdf.getDestination("p14"))[0] as TdestForPageIndex));
    console.log("toc", toc);

    master.subscribe("page", async (pageNumber: number) => {

        const pdfPage = await pdf.getPage(pageNumber);

        const viewportNoScale = pdfPage.getViewport({ scale: 1 });
        const scale = rootElement.clientWidth / viewportNoScale.width;
        const viewport = pdfPage.getViewport({ scale });

        const canvas2d = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({
            canvasContext: canvas2d,
            viewport,
        }).promise;

        master.dispatch("page", pageNumber);
    });

    return slave;
}
