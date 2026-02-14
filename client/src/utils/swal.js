import Swal from 'sweetalert2';

// Theme colors from tailwind.config.js
const colors = {
    primary: '#7D53F6',
    confirm: '#7D53F6',
    cancel: '#FF5555',
};

export const showAlert = (type, title, text) => {
    return Swal.fire({
        icon: type, // 'success', 'error', 'warning', 'info', 'question'
        title: title,
        text: text,
        confirmButtonColor: colors.primary,
    });
};

export const showSuccess = (title, text) => {
    return showAlert('success', title, text);
};

export const showError = (title, text) => {
    return showAlert('error', title, text);
};

export const showWarning = (title, text) => {
    return showAlert('warning', title, text);
};

export const showConfirm = async (title, text) => {
    const result = await Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: colors.confirm,
        cancelButtonColor: colors.cancel,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    });
    return result.isConfirmed;
};
