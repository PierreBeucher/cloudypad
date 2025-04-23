export function toBase64(data: string){
    return Buffer.from(data).toString("base64")
}

export function fromBase64(data: string){
    return Buffer.from(data, "base64").toString("utf8")
}