/* eslint-disable  @typescript-eslint/no-explicit-any */
// Axios don't leave much choice but to allow any

/**
 * Wrap a client error from Axios potential error
 */
export class CloudyPadAxiosError {
    message: any
    status?: number
    source?: any

    constructor(message: any, status?: number, source?: any) {
        this.message = message
        this.source = source
        this.status = status
    }
}

export function isAxios404NotFound(e: any){
    return e instanceof CloudyPadAxiosError && e.status == 404
}

// From doc https://axios-http.com/docs/handling_errors
export function buildAxiosError(error: any): CloudyPadAxiosError {

    if (error.response) {
        const finalError = new CloudyPadAxiosError(
            error.response.data?.message,
            error.response.status,
           JSON.stringify(error)
        )
        return finalError
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        const finalError = new CloudyPadAxiosError(
            "No response from server",
            undefined,
            JSON.stringify(error)
        )
        return finalError
    } else {
        // Something happened in setting up the request that triggered an Error
        const finalError = new CloudyPadAxiosError(
            error.message, 
            undefined,
            JSON.stringify(error)
        )
        return finalError
    }
}