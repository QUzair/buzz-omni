//! Publish the two signed Buzz records that make an externally hosted agent
//! discoverable and authorizable in the native mention picker.
//!
//! This example is compiled inside the pinned upstream `buzz-cli` package so
//! it uses the same Nostr, NIP-98, NIP-OA, HTTP, and crypto dependencies as
//! Buzz itself. Secrets are accepted only through the process environment.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use nostr::{Event, EventBuilder, Keys, Kind, Tag};
use sha2::{Digest, Sha256};
use std::error::Error;

type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("publish_agent_directory failed: {error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let relay_url = required("BUZZ_RELAY_URL")?
        .trim_end_matches('/')
        .to_string();
    let owner_secret = required("BUZZ_OWNER_PRIVATE_KEY")?;
    let agent_secret = required("BUZZ_AGENT_PRIVATE_KEY")?;
    let owner_keys = Keys::parse(&owner_secret)?;
    let agent_keys = Keys::parse(&agent_secret)?;
    let auth_tag = required("BUZZ_AUTH_TAG")?;
    let name = required("BUZZ_AGENT_NAME")?;
    let allowlist_value = required("BUZZ_RESPOND_TO_ALLOWLIST")?;
    let allowlist = parse_allowlist(&allowlist_value)?;

    buzz_sdk::nip_oa::verify_auth_tag(&auth_tag, &agent_keys.public_key())?;
    let auth_values: Vec<String> = serde_json::from_str(&auth_tag)?;
    let owner_pubkey = owner_keys.public_key().to_hex();
    if auth_values.get(1) != Some(&owner_pubkey) {
        return Err("BUZZ_AUTH_TAG owner does not match BUZZ_OWNER_PRIVATE_KEY".into());
    }

    let directory_content = serde_json::json!({
        "name": name,
        "agent_type": "agent",
        "status": "online",
        "respond_to": "allowlist",
        "respond_to_allowlist": allowlist,
    })
    .to_string();
    let directory_event =
        EventBuilder::new(Kind::Custom(10100), directory_content).sign_with_keys(&agent_keys)?;

    let policy_content = serde_json::json!({
        "name": name,
        "parallelism": 1,
        "respond_to": "allowlist",
        "respond_to_allowlist": allowlist,
    })
    .to_string();
    let agent_pubkey = agent_keys.public_key().to_hex();
    let policy_event = EventBuilder::new(Kind::Custom(30177), policy_content)
        .tags([Tag::parse(["d", agent_pubkey.as_str()])?])
        .sign_with_keys(&owner_keys)?;

    let client = reqwest::Client::new();
    publish(
        &client,
        &relay_url,
        &agent_keys,
        &directory_event,
        Some(&auth_tag),
    )
    .await?;
    publish(&client, &relay_url, &owner_keys, &policy_event, None).await?;

    println!(
        "{}",
        serde_json::json!({
            "agent_pubkey": agent_pubkey,
            "directory_event": directory_event.id.to_hex(),
            "policy_event": policy_event.id.to_hex(),
        })
    );
    Ok(())
}

fn required(name: &str) -> Result<String> {
    let value = std::env::var(name).map_err(|_| format!("{name} is required"))?;
    if value.trim().is_empty() {
        return Err(format!("{name} must not be empty").into());
    }
    Ok(value)
}

fn parse_allowlist(value: &str) -> Result<Vec<String>> {
    let mut output = Vec::new();
    for item in value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
    {
        let pubkey = nostr::PublicKey::from_hex(item)?.to_hex();
        if !output.contains(&pubkey) {
            output.push(pubkey);
        }
    }
    if output.is_empty() {
        return Err("BUZZ_RESPOND_TO_ALLOWLIST must contain at least one public key".into());
    }
    Ok(output)
}

async fn publish(
    client: &reqwest::Client,
    relay_url: &str,
    signer: &Keys,
    event: &Event,
    auth_tag: Option<&str>,
) -> Result<()> {
    let url = format!("{relay_url}/events");
    let body = serde_json::to_vec(event)?;
    let authorization = nip98_header(signer, &url, &body)?;
    let mut request = client
        .post(&url)
        .header("Authorization", authorization)
        .header("Content-Type", "application/json")
        .body(body);
    if let Some(auth_tag) = auth_tag {
        request = request.header("x-auth-tag", auth_tag);
    }
    let response = request.send().await?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "relay rejected kind {} with HTTP {status}",
            event.kind.as_u16()
        )
        .into());
    }
    Ok(())
}

fn nip98_header(keys: &Keys, url: &str, body: &[u8]) -> Result<String> {
    let payload_hash = hex::encode(Sha256::digest(body));
    let nonce = uuid::Uuid::new_v4().to_string();
    let tags = [
        Tag::parse(["u", url])?,
        Tag::parse(["method", "POST"])?,
        Tag::parse(["nonce", nonce.as_str()])?,
        Tag::parse(["payload", payload_hash.as_str()])?,
    ];
    let event = EventBuilder::new(Kind::Custom(27235), "")
        .tags(tags)
        .sign_with_keys(keys)?;
    let json = serde_json::to_string(&event)?;
    Ok(format!("Nostr {}", BASE64.encode(json.as_bytes())))
}
