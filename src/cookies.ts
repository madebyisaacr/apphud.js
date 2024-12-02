// https://www.quirksmode.org/js/cookies.html

const setCookie = (name: string, value: any, ttl: number): void => {
    let expires = "";
    const cookieDomain = "";
    if (ttl) {
        const date = new Date();
        date.setTime(date.getTime() + (ttl * 60 * 1000));
        expires = "; expires=" + (date as any).toGMTString();
    }

    document.cookie = name + "=" + encodeURIComponent(value) + expires + cookieDomain + "; path=/; samesite=lax";
};

const getCookie = (name: string): string | null => {
    let i, c;
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (i = 0; i < ca.length; i++) {
        c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
};

const deleteCookie = (name: string): void => {
    setCookie(name, "", -1);
};

export {setCookie, getCookie, deleteCookie}
