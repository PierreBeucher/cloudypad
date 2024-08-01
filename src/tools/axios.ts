/* eslint-disable  @typescript-eslint/no-explicit-any */
// Axios don't leave much choice but to allow any

/**
 * Wrap a client error from Axios potential error
 */
export interface AxiosError {
    message?: any
    status?: number
    source?: any
}

// From doc https://axios-http.com/docs/handling_errors
export async function buildAxiosError(error: any) {

    if (error.response) {
        const finalError: AxiosError = {
            message: error.response.data?.message,
            status: error.response.status,
            source: JSON.stringify(error)
        }
        return finalError
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        const finalError: AxiosError = {
            message: "No response from server",
            source: JSON.stringify(error)
        }
        return finalError
    } else {
        // Something happened in setting up the request that triggered an Error
        const finalError: AxiosError = {
            message: error.message,
            source: JSON.stringify(error)
        }
        return finalError
    }
}