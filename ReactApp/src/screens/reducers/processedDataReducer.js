export function processedDataReducer(state = {}, action) {
    switch (action.type) {
        case "@@acuant/ADD_ID_RESULT_DATA":
            return {
                ...state,
                result: action.payload
            };
        case "@@acuant/ADD_FACE_MATCH_DATA":
            return {
                ...state,
                faceMatch: action.payload
            };
        case "@@acuant/ADD_FACE_LIVENESS_DATA":
                return {
                    ...state,
                    liveness: action.payload
            };
        case "@@acuant/RESET_PROCESSED_DATA":
            return {
                faceMatch: null,
                result: null
            };
        default:
            return state;
    }
}