import * as util from '../lib/util';
import { API_SERVER_URL } from '../lib/globals';

const projectFiles = [];

document.getElementsByTagName('form')[0].onsubmit
= async function createFunction() {
    // Extract values from form
    const name = (document.getElementById('fn-name') as HTMLInputElement).value;
    const about = (document.getElementById('fn-about') as HTMLTextAreaElement).value;
    const allowForeignWorkers = !(document.getElementById('fn-pol-fws') as HTMLInputElement).checked;
    const preventReuse = !!(document.getElementById('fn-pol-reuse') as HTMLInputElement).checked;
    const optSpec = (document.getElementById('fn-pol-spec') as HTMLSelectElement).value;

    // Send data to server
    const resp = await util.post(
        API_SERVER_URL + '/portal/function',
        { name, about, allowForeignWorkers, preventReuse, optSpec },
    );
    if (resp.status === 401)
        return window.location.href = 'login.html';
    if (resp.status !== 200) {
        document.getElementById('failed-text').innerHTML = `Failed: ${resp.status}: ${resp.text}`;
        return false;
    }
    console.log('created function', resp.text);

    // Upload projectFiles
    const fd = new FormData();
    projectFiles.forEach((f, i) => fd.append(`file_${i}`, f, f.name));
    try {
        await fetch(`${API_SERVER_URL}/portal/function/${resp.text}/asset/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${util.getCookie('authToken')}`,
            },
            body: fd,
        });
    } catch (e) {
        console.error(e);
    }
    console.log('uploaded', projectFiles.length, 'project files');

    // Redirect user to manage page
    window.location.href = 'manage_function.html?id=' + resp.text;
}

// File drop area
const filesArea = document.getElementById('fn-files');
filesArea.ondragover = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();
    filesArea.style.border = '1px solid blue';
    filesArea.style.backgroundColor = 'grey';
};
filesArea.ondragleave = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();
    filesArea.style.border = '1px solid skyblue';
    filesArea.style.backgroundColor = 'darkgrey';
};
filesArea.ondrop = function (ev) {
    ev.preventDefault();
    // ev.stopPropagation();

    // Get files from drop event
    let files: File[] = [];
    if (ev.dataTransfer.items)
        files = [...ev.dataTransfer.items].filter(i => i.kind === 'file').map(f => f.getAsFile());
    else if (ev.dataTransfer.files)
        files = [...ev.dataTransfer.files];
    else
        console.error("wtf no files?", ev);

    // Process files
    files.forEach(f => {
        if (f.size > 1000 * 1000 * 20) {
            filesArea.innerHTML += `<br/><span class="small-fname invalid">${f.name} is over 20 MB cap</span>`;
            return;
        }

        filesArea.innerHTML += `<br/><span class="small-fname">${f.name} - ${f.size / 1000} kB</span>`;
        projectFiles.push(f);
    });
};