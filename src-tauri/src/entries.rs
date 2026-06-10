use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EntryType {
    Login,
    ApiKey,
    Note,
    SshKey,
    Card,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryBase {
    pub id: Uuid,
    pub name: String,
    pub folder_id: Option<Uuid>,
    pub tags: Vec<String>,
    pub icon: Option<String>,
    pub notes: String,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginFields {
    pub url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyFields {
    pub service: String,
    pub key: String,
    pub secret: Option<String>,
    pub token: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteFields {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyFields {
    pub public_key: String,
    pub private_key: String,
    pub passphrase: Option<String>,
    pub host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardFields {
    pub cardholder: String,
    pub number: String,
    pub expiry: String,
    pub cvv: String,
    pub billing_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "fields", rename_all = "snake_case")]
pub enum EntryFields {
    Login(LoginFields),
    ApiKey(ApiKeyFields),
    Note(NoteFields),
    SshKey(SshKeyFields),
    Card(CardFields),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    #[serde(flatten)]
    pub base: EntryBase,
    pub fields: EntryFields,
}

impl EntryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntryType::Login => "login",
            EntryType::ApiKey => "api_key",
            EntryType::Note => "note",
            EntryType::SshKey => "ssh_key",
            EntryType::Card => "card",
        }
    }
}

impl Entry {
    pub fn new(name: String, folder_id: Option<Uuid>, fields: EntryFields) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            base: EntryBase {
                id: Uuid::new_v4(),
                name,
                folder_id,
                tags: vec![],
                icon: None,
                notes: String::new(),
                favorite: false,
                created_at: now.clone(),
                updated_at: now,
            },
            fields,
        }
    }

    pub fn entry_type(&self) -> EntryType {
        match &self.fields {
            EntryFields::Login(_) => EntryType::Login,
            EntryFields::ApiKey(_) => EntryType::ApiKey,
            EntryFields::Note(_) => EntryType::Note,
            EntryFields::SshKey(_) => EntryType::SshKey,
            EntryFields::Card(_) => EntryType::Card,
        }
    }
}
