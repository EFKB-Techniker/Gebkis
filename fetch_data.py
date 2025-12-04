import os
from dotenv import load_dotenv
import requests
from requests_oauthlib import OAuth2Session
from oauthlib.oauth2 import BackendApplicationClient
import logging
import json
import fnmatch
import urllib.parse

# Prüfe ob alle benötigten Umgebungsvariablen gesetzt sind
required_env_vars = {
    'CLIENT_ID': os.getenv('CLIENT_ID'),
    'CLIENT_SECRET': os.getenv('CLIENT_SECRET'),
    'TENANT_ID': os.getenv('TENANT_ID'),
    'SITE_ID': os.getenv('SITE_ID'),
    'DRIVE_ID': os.getenv('DRIVE_ID'),
    'EXCEL_FILE_PATH': os.getenv('EXCEL_FILE_PATH'),
    'IMAGE_FOLDER_PATH': os.getenv('IMAGE_FOLDER_PATH'),
    'LOG_DIR': os.getenv('LOG_DIR')
}

def setup_logger():
    log_dir = required_env_vars['LOG_DIR'] or '.'
    os.makedirs(log_dir, exist_ok=True)
    
    logger = logging.getLogger('fetch_data')
    logger.setLevel(logging.DEBUG)
    
    # Handler für Datei
    file_handler = logging.FileHandler(f'{log_dir}/fetch_data.log')
    file_handler.setLevel(logging.DEBUG)
    
    # Handler für Konsole
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# Logger global initialisieren
logger = setup_logger()

# Prüfe auf fehlende Umgebungsvariablen
missing_vars = [var for var, value in required_env_vars.items() if value is None]
if missing_vars:
    error_msg = f"Fehlende Umgebungsvariablen: {', '.join(missing_vars)}"
    logger.error(error_msg)
    raise ValueError(error_msg)

# Setze die Variablen
client_id = required_env_vars['CLIENT_ID']
client_secret = required_env_vars['CLIENT_SECRET']
tenant_id = required_env_vars['TENANT_ID']
site_id = required_env_vars['SITE_ID']
drive_id = required_env_vars['DRIVE_ID']
excel_file_path = required_env_vars['EXCEL_FILE_PATH']
image_folder_path = required_env_vars['IMAGE_FOLDER_PATH']

# Die URL für den Microsoft OAuth 2.0 Token-Endpunkt
token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'

# Scope für die Microsoft Graph API, um auf SharePoint zuzugreifen
scope = ['https://graph.microsoft.com/.default']

# Erstelle einen OAuth2 Session-Client
client = BackendApplicationClient(client_id=client_id)
oauth = OAuth2Session(client=client)

# Hole das Zugangstoken
def get_access_token():
    logger.debug("Versuche Token zu holen...")
    logger.debug(f"Token URL: {token_url}")
    logger.debug(f"Scope: {scope}")
    try:
        token = oauth.fetch_token(token_url, client_id=client_id, client_secret=client_secret, scope=scope)
        logger.info("Token erfolgreich geholt")
        return token['access_token']
    except Exception as e:
        logger.error(f"Fehler beim Token-Abruf: {str(e)}")
        raise

# Hilfsfunktion um File ID anhand des Pfades zu ermitteln
def get_file_id_from_path(access_token, full_path):
    logger.info(f"Suche Datei mit Pfad-Pattern: {full_path}")
    
    # Pfad und Dateinamen-Pattern trennen
    if '/' in full_path:
        folder_path, file_pattern = full_path.rsplit('/', 1)
    else:
        folder_path = ""
        file_pattern = full_path
        
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # URL zum Auflisten des Ordnerinhalts
    if folder_path:
        # Syntax: /drives/{drive-id}/root:/{path-relative-to-root}:/children
        folder_url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{folder_path}:/children'
    else:
        # Root folder
        folder_url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root/children'
        
    logger.debug(f"Liste Ordnerinhalt auf: {folder_url}")
    
    try:
        response = requests.get(folder_url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Fehler beim Auflisten des Ordners. Status: {response.status_code}, Body: {response.text}")
            raise Exception(f"Konnte Ordnerinhalt nicht abrufen: {response.status_code}")
            
        data = response.json()
        files = data.get('value', [])
        
        for file in files:
            if 'file' in file: # Sicherstellen, dass es eine Datei ist
                if fnmatch.fnmatch(file['name'], file_pattern):
                    logger.info(f"Datei gefunden: {file['name']} (ID: {file['id']})")
                    return file['id'], file['name']
                    
        error_msg = f"Keine Datei gefunden, die dem Pattern '{file_pattern}' im Ordner '{folder_path}' entspricht."
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
        
    except Exception as e:
        logger.error(f"Fehler bei der Dateisuche: {str(e)}")
        raise

# Abrufen der XLS-Datei von SharePoint
def download_xls(access_token):
    logger.debug("Starte XLS Download...")
    
    # Hole ID dynamisch anhand des Pfades
    try:
        file_id, file_name = get_file_id_from_path(access_token, excel_file_path)
    except Exception as e:
        logger.error(f"Abbruch: Konnte Datei-ID nicht ermitteln. {str(e)}")
        raise

    sharepoint_url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/content'
    headers = {"Authorization": f"Bearer {access_token}"}
    
    logger.debug(f"SharePoint URL: {sharepoint_url}")
    # logger.debug(f"Request Headers: {headers}") DEBUG ONLY !!!!
    
    try:
        response = requests.get(sharepoint_url, headers=headers)
        logger.debug(f"SharePoint API Status: {response.status_code}")

        if response.status_code == 200:
            gebkis_dir = os.getenv('GEBKIS_DIR')
            os.makedirs(gebkis_dir, exist_ok=True)
            
            # Alte Excel-Dateien bereinigen, damit nur die aktuelle vorhanden ist
            try:
                for f in os.listdir(gebkis_dir):
                    if f.lower().endswith(('.xls', '.xlsx')):
                        os.remove(os.path.join(gebkis_dir, f))
                        logger.info(f"Alte Datei entfernt: {f}")
            except Exception as e:
                logger.warning(f"Fehler beim Bereinigen alter Dateien: {e}")

            save_path = os.path.join(gebkis_dir, file_name)
            with open(save_path, 'wb') as file:
                file.write(response.content)
            logger.info(f"XLS-Datei erfolgreich gespeichert: {save_path}")
        else:
            logger.error(f"Download fehlgeschlagen. Status: {response.status_code}")
    except Exception as e:
        logger.error(f"Fehler beim XLS-Download: {str(e)}")
        raise

# Hilfsfunktion um Folder ID anhand des Pfades zu ermitteln
def get_folder_id_from_path(access_token, folder_path):
    logger.info(f"Ermittle ID für Ordnerpfad: {folder_path}")
    
    # Backslashes zu Forward Slashes konvertieren
    folder_path = folder_path.replace('\\', '/')
    
    # Führenden Slash entfernen falls vorhanden
    if folder_path.startswith('/'):
        folder_path = folder_path[1:]
        
    # URL Encoding für den Pfad
    encoded_path = urllib.parse.quote(folder_path)
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # URL konstruieren
    url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{encoded_path}'
    
    logger.debug(f"Folder Lookup URL: {url}")
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            folder_id = data['id']
            logger.info(f"Ordner ID gefunden: {folder_id}")
            return folder_id
        else:
            logger.error(f"Konnte Ordner ID nicht ermitteln. Status: {response.status_code}, Body: {response.text}")
            raise Exception(f"Ordner nicht gefunden: {folder_path}")
    except Exception as e:
        logger.error(f"Fehler beim Folder Lookup: {str(e)}")
        raise

# Neue Funktion zum Synchronisieren der Bilder
def sync_images(access_token):
    logger.debug("Starte Bildsynchronisation...")
    
    # Hole Folder ID dynamisch
    try:
        image_folder_id = get_folder_id_from_path(access_token, image_folder_path)
    except Exception as e:
        logger.error(f"Abbruch: Konnte Bilder-Ordner ID nicht ermitteln. {str(e)}")
        raise

    folder_url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{image_folder_id}/children'
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        target_dir = os.getenv('GEBKIS_IMG_DIR')
        os.makedirs(target_dir, exist_ok=True)
        
        cache_file = os.path.join(target_dir, 'etag_cache.json')
        try:
            with open(cache_file, 'r') as f:
                etag_cache = json.load(f)
        except FileNotFoundError:
            etag_cache = {}
        
        # Sammle alle SharePoint-Dateien
        sharepoint_filenames = set()
        next_link = folder_url
        total_files = 0
        updated_files = 0
        new_etag_cache = {}
        
        while next_link:
            response = requests.get(next_link, headers=headers)
            if response.status_code != 200:
                logger.error(f"Fehler beim Abrufen der Bilderliste: {response.status_code}")
                return
                
            response_data = response.json()
            sharepoint_files = response_data.get('value', [])
            total_files += len(sharepoint_files)
            
            for file in sharepoint_files:
                if file.get('name', '').lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    file_name = file['name']
                    sharepoint_filenames.add(file_name)  # Füge Datei zur SharePoint-Liste hinzu
                    file_id = file['id']
                    current_etag = file.get('eTag', '')
                    target_path = os.path.join(target_dir, file_name)
                    
                    # Speichere neuen eTag
                    new_etag_cache[file_name] = current_etag
                    
                    # Prüfe ob Download notwendig
                    should_download = (
                        not os.path.exists(target_path) or  # Datei existiert nicht
                        file_name not in etag_cache or      # Keine Cache-Information
                        etag_cache[file_name] != current_etag  # eTag hat sich geändert
                    )
                    
                    if should_download:
                        download_url = f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/items/{file_id}/content'
                        img_response = requests.get(download_url, headers=headers)
                        if img_response.status_code == 200:
                            with open(target_path, 'wb') as f:
                                f.write(img_response.content)
                            updated_files += 1
                            logger.info(f"Bild aktualisiert: {file_name}")
                        else:
                            logger.error(f"Fehler beim Download von {file_name}: {img_response.status_code}")
                    else:
                        logger.debug(f"Bild unverändert, überspringe: {file_name}")
            
            next_link = response_data.get('@odata.nextLink', None)
        
        # Finde und lösche lokale Dateien, die nicht mehr auf SharePoint existieren
        local_files = [f for f in os.listdir(target_dir) 
                      if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
        deleted_files = 0
        
        for local_file in local_files:
            if local_file not in sharepoint_filenames:
                file_path = os.path.join(target_dir, local_file)
                try:
                    os.remove(file_path)
                    if local_file in new_etag_cache:
                        del new_etag_cache[local_file]
                    deleted_files += 1
                    logger.info(f"Gelöschte Datei entfernt: {local_file}")
                except Exception as e:
                    logger.error(f"Fehler beim Löschen von {local_file}: {str(e)}")
        
        # Speichere aktualisierten etag-Cache
        with open(cache_file, 'w') as f:
            json.dump(new_etag_cache, f)
            
        logger.info(f"Bildsynchronisation abgeschlossen. Gesamt: {total_files}, "
                   f"Aktualisiert: {updated_files}, Gelöscht: {deleted_files}")
    except Exception as e:
        logger.error(f"Fehler bei der Bildsynchronisation: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        logger.info("Starte Datenabruf...")
        token = get_access_token()
        download_xls(token)
        sync_images(token)  # Neue Funktion aufrufen
        logger.info("Prozess erfolgreich abgeschlossen")
    except Exception as e:
        logger.error(f"Programmfehler: {str(e)}")
