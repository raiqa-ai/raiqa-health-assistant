const { EncryptionManager } = require("../EncryptionManager");

// When running locally will occupy the 0.0.0.0 hostname space but when deployed inside
// of docker this endpoint is not exposed so it is only on the Docker instances internal network
// so no additional security is needed on the endpoint directly. Auth is done however by the express
// middleware prior to leaving the node-side of the application so that is good enough >:)
class CollectorApi {
  constructor() {
    const { CommunicationKey } = require("../comKey");
    this.comkey = new CommunicationKey();
    
    // Default for local development only
    const defaultEndpoint = process.env.NODE_ENV === "development" 
      ? `http://0.0.0.0:${process.env.COLLECTOR_PORT || '8888'}`
      : null;
    
    this.endpoint = process.env.COLLECTOR_ENDPOINT || defaultEndpoint;
    
    if (!this.endpoint) {
      throw new Error('COLLECTOR_ENDPOINT environment variable must be set in non-development environments');
    }
    
    this.log(`Collector endpoint configured as: ${this.endpoint}`);  
  }

  log(text, ...args) {
    console.log(`\x1b[36m[CollectorApi]\x1b[0m ${text}`, ...args);
  }

  #attachOptions() {
    return {
      whisperProvider: process.env.WHISPER_PROVIDER || "local",
      WhisperModelPref: process.env.WHISPER_MODEL_PREF,
      openAiKey: process.env.OPEN_AI_KEY || null,
    };
  }

  async online() {
    return await fetch(this.endpoint)
      .then((res) => res.ok)
      .catch(() => false);
  }

  async acceptedFileTypes() {
    return await fetch(`${this.endpoint}/accepts`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to GET /accepts");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        this.log(e.message);
        return null;
      });
  }

  async processDocument(filename = "") {
    if (!filename) return false;

    const data = JSON.stringify({
      filename,
      options: this.#attachOptions(),
    });

    try {
      const integrity = this.comkey.sign(data);
      const payloadSigner = this.comkey.encrypt(new EncryptionManager().xPayload);
      
      console.log('Sending request to collector:', {
        endpoint: `${this.endpoint}/process`,
        filename,
        integrityLength: integrity.length,
        payloadSignerLength: payloadSigner.length
      });

      const response = await fetch(`${this.endpoint}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Integrity": integrity,
          "X-Payload-Signer": payloadSigner,
        },
        body: data,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Collector response error:', {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (e) {
      this.log(`Error processing document: ${e.message}`);
      return { 
        success: false, 
        reason: `Failed to process document: ${e.message}`, 
        documents: [] 
      };
    }
  }

  async processLink(link = "") {
    if (!link) return false;

    const data = JSON.stringify({ link });
    return await fetch(`${this.endpoint}/process-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integrity": this.comkey.sign(data),
        "X-Payload-Signer": this.comkey.encrypt(
          new EncryptionManager().xPayload
        ),
      },
      body: data,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Response could not be completed");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        this.log(e.message);
        return { success: false, reason: e.message, documents: [] };
      });
  }

  async processRawText(textContent = "", metadata = {}) {
    const data = JSON.stringify({ textContent, metadata });
    return await fetch(`${this.endpoint}/process-raw-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integrity": this.comkey.sign(data),
        "X-Payload-Signer": this.comkey.encrypt(
          new EncryptionManager().xPayload
        ),
      },
      body: data,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Response could not be completed");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        this.log(e.message);
        return { success: false, reason: e.message, documents: [] };
      });
  }

  // We will not ever expose the document processor to the frontend API so instead we relay
  // all requests through the server. You can use this function to directly expose a specific endpoint
  // on the document processor.
  async forwardExtensionRequest({ endpoint, method, body }) {
    return await fetch(`${this.endpoint}${endpoint}`, {
      method,
      body, // Stringified JSON!
      headers: {
        "Content-Type": "application/json",
        "X-Integrity": this.comkey.sign(body),
        "X-Payload-Signer": this.comkey.encrypt(
          new EncryptionManager().xPayload
        ),
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Response could not be completed");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        this.log(e.message);
        return { success: false, data: {}, reason: e.message };
      });
  }

  async getLinkContent(link = "") {
    if (!link) return false;

    const data = JSON.stringify({ link });
    return await fetch(`${this.endpoint}/util/get-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integrity": this.comkey.sign(data),
        "X-Payload-Signer": this.comkey.encrypt(
          new EncryptionManager().xPayload
        ),
      },
      body: data,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Response could not be completed");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        this.log(e.message);
        return { success: false, content: null };
      });
  }
}

module.exports.CollectorApi = CollectorApi;
