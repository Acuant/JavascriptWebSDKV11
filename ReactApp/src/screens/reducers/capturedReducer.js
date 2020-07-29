export function capturedReducer(state = {}, action) {
    switch (action.type) {
        case "@@acuant/ADD_CAPTURED_IMAGE":
            return {
                ...action.data
            };
        default:
            return state;
    }
}