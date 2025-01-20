document.addEventListener('DOMContentLoaded', () => {
    // Video Background hinzufügen
    const videoBackground = document.createElement('video');
    videoBackground.id = 'video-background';
    videoBackground.autoplay = true;
    videoBackground.loop = true;
    videoBackground.muted = true;
    videoBackground.playsinline = true;
    videoBackground.src = 'images/background.mp4';
    document.body.appendChild(videoBackground);

    let currentWeek = 0;
    const CURRENT_DATE = new Date(); // Verwendet das aktuelle Datum
    const CURRENT_USER = 'r0xx5';

    // Container für die gesamte App erstellen
    const appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);

    // Header erstellen
    const header = document.createElement('div');
    header.className = 'app-header';
    
    // Zurück-Button
    const prevWeekBtn = document.createElement('button');
    prevWeekBtn.className = 'nav-button';
    prevWeekBtn.innerHTML = '◀';
    
    // Titel
    const title = document.createElement('h1');
    title.textContent = 'Geburtstage der Woche';
    
    // Vor-Button
    const nextWeekBtn = document.createElement('button');
    nextWeekBtn.className = 'nav-button';
    nextWeekBtn.innerHTML = '▶';

    // Header zusammenbauen
    header.appendChild(prevWeekBtn);
    header.appendChild(title);
    header.appendChild(nextWeekBtn);
    
    // Geburtstagsliste Container erstellen
    const birthdayList = document.createElement('div');
    birthdayList.id = 'birthdayList';

    // Komponenten zur App hinzufügen
    appContainer.appendChild(header);
    appContainer.appendChild(birthdayList);

    prevWeekBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentWeek--;
        updateBirthdayList();
        updateTitle();
    });

    nextWeekBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentWeek++;
        updateBirthdayList();
        updateTitle();
    });

    document.addEventListener('keydown', handleKeyPress);

    function handleKeyPress(event) {
        switch(event.key.toLowerCase()) {
            case 'j':
                navigateToPreviousWeek();
                break;
            case 'l':
                navigateToNextWeek();
                break;
            case 'k':
                navigateToCurrentWeek();
                break;
        }
    }

    function navigateToPreviousWeek() {
        currentWeek--;
        updateTitle();
        updateBirthdayList();
    }

    function navigateToNextWeek() {
        currentWeek++;
        updateTitle();
        updateBirthdayList();
    }

    function navigateToCurrentWeek() {
        currentWeek = 0;
        updateTitle();
        updateBirthdayList();
    }

    function updateTitle() {
        title.textContent = `Geburtstage ${getCurrentWeekRange()}`;
    }

    function parseDateDE(dateStr) {
        if (!dateStr) return null;
        
        if (!isNaN(dateStr)) {
            const date = new Date('1900-01-01');
            date.setDate(date.getDate() + parseInt(dateStr) - 2);
            return date;
        }
        
        let parts;
        if (dateStr.includes('.')) {
            parts = dateStr.split('.').map(part => part.trim());
        } else if (dateStr.includes('-')) {
            parts = dateStr.split('-').reverse().map(part => part.trim());
        } else {
            return null;
        }

        const [day, month, year] = parts.map(num => parseInt(num, 10));
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

        const date = new Date(year, month - 1, day);
        date.setHours(12, 0, 0, 0);
        return date;
    }

    function formatDateDE(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    function formatDateUSShort(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        return `${month}.${day}.${year}`;
    }

    function convertUmlautsInFilename(name) {
        // Umlaute-Mapping
        const umlautMap = {
            'ä': 'ae',
            'ö': 'oe',
            'ü': 'ue',
            'Ä': 'Ae',
            'Ö': 'Oe',
            'Ü': 'Ue',
            'ß': 'ss'
        };

        // Ersetze alle Umlaute durch ihre entsprechende Kombination
        return name.replace(/[äöüÄÖÜß]/g, (umlaut) => umlautMap[umlaut]);
    }

    function getMonday(date) {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Wenn Sonntag, dann -6
        const monday = new Date(date);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    function filterBirthdays(birthdays, weekOffset) {
        const current = new Date(CURRENT_DATE);
        const monday = getMonday(current);
        monday.setDate(monday.getDate() + (weekOffset * 7));
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        // Debug-Ausgabe
        console.log('Filterperiode:', formatDateDE(monday), 'bis', formatDateDE(sunday));

        return birthdays.filter(birthday => {
            if (!birthday.vorname || !birthday.nachname || !birthday.geburtsdatum) return false;
            
            const birthDate = parseDateDE(birthday.geburtsdatum);
            if (!birthDate || isNaN(birthDate.getTime())) {
                console.log('Ungültiges Datum:', birthday.geburtsdatum);
                return false;
            }

            // Vergleiche nur Tag und Monat
            const currentYear = CURRENT_DATE.getFullYear();
            const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
            
            return years.some(year => {
                const checkDate = new Date(year, birthDate.getMonth(), birthDate.getDate());
                const isInRange = checkDate >= monday && checkDate <= sunday;
                
                // Debug-Ausgabe
                if (birthday.geburtsdatum === '12.01.1993') {
                    console.log('Prüfe Jahr:', year, 
                              'Datum:', formatDateDE(checkDate), 
                              'In Range:', isInRange);
                }
                
                return isInRange;
            });
        }).sort((a, b) => {
            const dateA = parseDateDE(a.geburtsdatum);
            const dateB = parseDateDE(b.geburtsdatum);
            const monthA = dateA.getMonth();
            const monthB = dateB.getMonth();
            if (monthA !== monthB) return monthA - monthB;
            return dateA.getDate() - dateB.getDate();
        });
    }

    function updateBirthdayList() {
        fetch('data/Geburtstagsliste.xls')
            .then(response => {
                if (!response.ok) {
                    throw new Error('XLS Datei konnte nicht geladen werden');
                }
                return response.arrayBuffer();
            })
            .then(data => {
                const workbook = XLSX.read(new Uint8Array(data), {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                let birthdays = [];
                try {
                    birthdays = XLSX.utils.sheet_to_json(worksheet, {
                        header: 'A',
                        range: 1,
                        raw: true
                    });

                    birthdays = birthdays.map(row => ({
                        vorname: row.B || '',
                        nachname: row.C || '',
                        geburtsdatum: row.D || '',
                    }));

                } catch (e) {
                    console.error('Fehler beim Parsen der XLS:', e);
                    throw e;
                }

                const filteredBirthdays = filterBirthdays(birthdays, currentWeek);
                displayBirthdays(filteredBirthdays);
            })
            .catch(error => {
                console.error('Fehler beim Laden oder Verarbeiten der XLS:', error);
                birthdayList.innerHTML = `
                    <div class="no-birthdays">
                        <p>Fehler beim Laden der Geburtstagsliste</p>
                        <p>${error.message}</p>
                    </div>
                `;
            });
    }

    function displayBirthdays(birthdays) {
        birthdayList.innerHTML = '';
        
        const gridContainer = document.createElement('div');
        gridContainer.className = 'birthday-grid';
        birthdayList.appendChild(gridContainer);

        if (birthdays.length === 0) {
            gridContainer.innerHTML = `
                <div class="no-birthdays">
                    <p>Keine Geburtstage in dieser Woche</p>
                </div>`;
            return;
        }

        birthdays.forEach(birthday => {
            const birthDate = parseDateDE(birthday.geburtsdatum);
            const formattedDate = `${birthDate.getDate().toString().padStart(2, '0')}. ${getMonthName(birthDate.getMonth())}`;
            
            const birthdayItem = document.createElement('div');
            birthdayItem.className = 'birthday-item';

            birthdayItem.innerHTML = `
                <img src="images/keinfoto.png" alt="${birthday.vorname} ${birthday.nachname}" 
                     data-error-reported="false">
                <p class="name">${birthday.nachname} ${birthday.vorname}</p>
                <p class="date">${formattedDate}</p>
            `;

            gridContainer.appendChild(birthdayItem);

            const personalImage = new Image();
            const imgElement = birthdayItem.querySelector('img');

            personalImage.onload = () => {
                imgElement.src = personalImage.src;
            };

            personalImage.onerror = () => {
                if (imgElement.dataset.errorReported === "false") {
                    console.log(`Info: Verwende Standardbild für ${birthday.vorname} ${birthday.nachname}`);
                    imgElement.dataset.errorReported = "true";
                }
            };

            const imageDate = formatDateUSShort(birthDate);
            // Konvertiere Umlaute im Nachnamen und Vornamen für den Dateinamen
            const convertedNachname = convertUmlautsInFilename(birthday.nachname);
            const convertedVorname = convertUmlautsInFilename(birthday.vorname);
            personalImage.src = `images/${imageDate} - ${convertedNachname}, ${convertedVorname}.jpg`;
        });
    }

    function getCurrentWeekRange() {
        const monday = new Date(CURRENT_DATE);
        monday.setDate(CURRENT_DATE.getDate() - CURRENT_DATE.getDay() + 1 + (currentWeek * 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        return `${formatDateDE(monday)} - ${formatDateDE(sunday)}`;
    }

    function getMonthName(monthIndex) {
        const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        return months[monthIndex];
    }

    // Initiale Aktualisierung
    updateTitle();
    updateBirthdayList();
});