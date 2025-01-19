async function fetchBirthdays() {
    try {
        const response = await fetch('/api/birthdays');
        if (!response.ok) {
            throw new Error('Netzwerkfehler');
        }
        const data = await response.json();
        displayBirthdays(data);
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        showError('Daten konnten nicht geladen werden');
    }
}

function displayBirthdays(birthdays) {
    const container = document.getElementById('birthdayList');
    if (birthdays.length === 0) {
        container.innerHTML = '<p>Keine Geburtstage gefunden.</p>';
        return;
    }
    
    const sortedBirthdays = birthdays.sort((a, b) => 
        new Date(a.Geburtstag) - new Date(b.Geburtstag)
    );

    container.innerHTML = sortedBirthdays
        .map(birthday => `
            <div class="birthday-item">
                <span class="name">${birthday.Title}</span>
                <span class="date">${formatDate(birthday.Geburtstag)}</span>
            </div>
        `)
        .join('');
}

function formatDate(dateString) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('de-DE', options);
}

function showError(message) {
    const container = document.getElementById('birthdayList');
    container.innerHTML = `<p class="error">${message}</p>`;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchBirthdays();
    document.getElementById('refreshBtn').addEventListener('click', fetchBirthdays);
});