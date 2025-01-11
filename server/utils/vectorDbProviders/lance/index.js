const lancedb = require("@lancedb/lancedb");
const { toChunks, getEmbeddingEngineSelection } = require("../../helpers");
const { TextSplitter } = require("../../TextSplitter");
const { SystemSettings } = require("../../../models/systemSettings");
const { storeVectorResult, cachedVectorInformation } = require("../../files");
const { v4: uuidv4 } = require("uuid");
const { sourceIdentifier } = require("../../chats");
const path = require('path');
const fs = require('fs');

/**
 * LancedDB Client connection object
 * @typedef {import('@lancedb/lancedb').Connection} LanceClient
 */

const normalizeMetadata = (metadata = {}) => {
  // Extract nested metadata if it exists
  const meta = metadata.metadata || metadata;
  
  return {
    id: meta.id || metadata.id || '',
    title: meta.title || metadata.title || '',
    type: meta.type || metadata.type || 'file',
    source: meta.source || metadata.source || 'local://document',
    chunkSource: meta.chunkSource || metadata.chunkSource || 'local://document',
    originalName: meta.originalName || metadata.originalName || '',
    uploadDate: meta.uploadDate || metadata.uploadDate || new Date().toISOString(),
    fileType: meta.fileType || metadata.fileType || '',
    encoding: meta.encoding || metadata.encoding || 'base64',
    docAuthor: meta.docAuthor || metadata.docAuthor || 'manual upload',
    description: meta.description || metadata.description || ''
  };
};

const lanceDbPath = process.env.NODE_ENV === "development"
  ? path.resolve(__dirname, "../../../storage/lancedb")
  : path.resolve(process.env.STORAGE_DIR, "lancedb");

const LanceDb = {
  uri: lanceDbPath,
  name: "LanceDb",

  /** @returns {Promise<{client: LanceClient}>} */
  connect: async function () {
    if (process.env.VECTOR_DB !== "lancedb")
      throw new Error("LanceDB::Invalid ENV settings");

    try {
      if (!fs.existsSync(lanceDbPath)) {
        fs.mkdirSync(lanceDbPath, { 
          recursive: true, 
          mode: 0o755
        });
      }
      
      try {
        fs.accessSync(lanceDbPath, fs.constants.W_OK);
      } catch (e) {
        throw new Error(`LanceDB directory ${lanceDbPath} is not writable: ${e.message}`);
      }
      
      const client = await lancedb.connect(lanceDbPath);
      return {
        client,
        error: null,
      };
    } catch (e) {
      console.error("Failed to connect to LanceDB:", e);
      return {
        client: null,
        error: e.message,
      };
    }
  },
  distanceToSimilarity: function (distance = null) {
    if (distance === null || typeof distance !== "number") return 0.0;
    if (distance >= 1.0) return 1;
    if (distance <= 0) return 0;
    return 1 - distance;
  },
  heartbeat: async function () {
    await this.connect();
    return { heartbeat: Number(new Date()) };
  },
  tables: async function () {
    const { client } = await this.connect();
    return await client.tableNames();
  },
  totalVectors: async function () {
    const { client } = await this.connect();
    const tables = await client.tableNames();
    let count = 0;
    for (const tableName of tables) {
      const table = await client.openTable(tableName);
      count += await table.countRows();
    }
    return count;
  },
  namespaceCount: async function (_namespace = null) {
    const { client } = await this.connect();
    const exists = await this.namespaceExists(client, _namespace);
    if (!exists) return 0;

    const table = await client.openTable(_namespace);
    return (await table.countRows()) || 0;
  },
  /**
   * Performs a SimilaritySearch on a give LanceDB namespace.
   * @param {LanceClient} client
   * @param {string} namespace
   * @param {number[]} queryVector
   * @param {number} similarityThreshold
   * @param {number} topN
   * @param {string[]} filterIdentifiers
   * @returns
   */
  similarityResponse: async function (
    client,
    namespace,
    queryVector,
    similarityThreshold = 0.25,
    topN = 4,
    filterIdentifiers = []
  ) {
    const collection = await client.openTable(namespace);
    const result = {
      contextTexts: [],
      sourceDocuments: [],
      scores: [],
    };

    const response = await collection
      .vectorSearch(queryVector)
      .distanceType("cosine")
      .limit(topN)
      .toArray();

    response.forEach((item) => {
      if (this.distanceToSimilarity(item._distance) < similarityThreshold)
        return;
      const { vector: _, ...rest } = item;
      if (filterIdentifiers.includes(sourceIdentifier(rest))) {
        console.log(
          "LanceDB: A source was filtered from context as it's parent document is pinned."
        );
        return;
      }

      result.contextTexts.push(rest.text);
      result.sourceDocuments.push({
        ...rest,
        score: this.distanceToSimilarity(item._distance),
      });
      result.scores.push(this.distanceToSimilarity(item._distance));
    });

    return result;
  },
  /**
   *
   * @param {LanceClient} client
   * @param {string} namespace
   * @returns
   */
  namespace: async function (client, namespace = null) {
    if (!namespace) throw new Error("No namespace value provided.");
    const collection = await client.openTable(namespace).catch(() => false);
    if (!collection) return null;

    return {
      ...collection,
    };
  },
  /**
   *
   * @param {LanceClient} client
   * @param {number[]} data
   * @param {string} namespace
   * @returns
   */
  updateOrCreateCollection: async function (client, data = [], namespace) {
    try {
      console.log("Updating or creating collection:", namespace);
      const hasNamespace = await this.hasNamespace(namespace);
      if (hasNamespace) {
        const collection = await client.openTable(namespace);
        await collection.add(data);
        return true;
      }

      await client.createTable(namespace, data);
      console.log("Collection created successfully:", namespace);
      return true;
    } catch (error) {
      try {
        await this.handleFileOperation(error);
        return true;
      } catch (e) {
        throw error;
      }
    }
  },
  hasNamespace: async function (namespace = null) {
    if (!namespace) return false;
    const { client } = await this.connect();
    const exists = await this.namespaceExists(client, namespace);
    return exists;
  },
  /**
   *
   * @param {LanceClient} client
   * @param {string} namespace
   * @returns
   */
  namespaceExists: async function (client, namespace = null) {
    if (!namespace) throw new Error("No namespace value provided.");
    const collections = await client.tableNames();
    return collections.includes(namespace);
  },
  /**
   *
   * @param {LanceClient} client
   * @param {string} namespace
   * @returns
   */
  deleteVectorsInNamespace: async function (client, namespace = null) {
    if (!namespace) throw new Error("No namespace value provided.");
    const { DocumentVectors } = require("../../../models/vectors");
    
    try {
      console.log(`[LanceDB] Attempting to delete vectors from namespace: ${namespace}`);
      const collection = await client.openTable(namespace);
      
      try {
        // Delete all vectors in the table
        await collection.delete('1=1');
        console.log(`[LanceDB] Successfully deleted all vectors from namespace`);
      } catch (error) {
        console.log(`[LanceDB] Primary delete operation failed, attempting manual file operation`);
        await this.handleFileOperation(error, 'delete_vectors');
      }
      
      // We don't need to query by namespace since the workspace deletion 
      // already handles document vector cleanup
      console.log(`[LanceDB] Vector deletion complete for namespace ${namespace}`);
      return true;
    } catch (e) {
      console.error("[LanceDB] Failed to delete vectors in namespace", {
        namespace,
        error: e.message,
        stack: e.stack,
        operation: 'delete_vectors'
      });
      throw new Error(
        `Failed to delete rows in table ${namespace}: predicate=${e.message}`
      );
    }
  },
  deleteDocumentFromNamespace: async function (namespace, docId) {
    const { client } = await this.connect();
    const exists = await this.namespaceExists(client, namespace);
    if (!exists) {
      console.log(`[LanceDB] Namespace ${namespace} does not exist for deletion`);
      return;
    }

    const { DocumentVectors } = require("../../../models/vectors");
    const knownDocuments = await DocumentVectors.where({ docId });
    if (knownDocuments.length === 0) return;

    try {
      const table = await client.openTable(namespace);
      const vectorIds = knownDocuments.map((record) => record.vectorId);
      console.log(`[LanceDB] Attempting to delete ${vectorIds.length} vectors for document ${docId}`);
      
      try {
        const deleteQuery = `id IN ('${vectorIds.join("', '")}')`;
        console.log(`[LanceDB] Executing delete query: ${deleteQuery}`);
        await table.delete(deleteQuery);
      } catch (error) {
        console.log(`[LanceDB] Delete operation failed, attempting manual file operation`);
        await this.handleFileOperation(error, 'delete_document');
      }

      const indexes = knownDocuments.map((doc) => doc.id);
      await DocumentVectors.deleteIds(indexes);
      return true;
    } catch (e) {
      console.error(`[LanceDB] Failed to delete document from namespace`, {
        namespace,
        docId,
        error: e.message,
        stack: e.stack
      });
      throw e;
    }
  },
  addDocumentToNamespace: async function (
    namespace,
    documentData = {},
    fullFilePath = null,
    skipCache = false
  ) {
    const { DocumentVectors } = require("../../../models/vectors");
    try {
      console.log("[LanceDB] Received document data:", {
        hasPageContent: !!documentData.pageContent,
        docId: documentData.docId,
        metadataKeys: Object.keys(documentData),
      });

      const { pageContent, docId, ...metadata } = documentData;
      
      // Enhanced validation
      if (!pageContent || pageContent.length == 0) {
        console.error("[LanceDB] Missing or empty pageContent");
        return false;
      }
      if (!docId) {
        console.error("[LanceDB] Missing docId in document data");
        throw new Error('Document ID is required for vector storage');
      }

      // Validate docId format (assuming it should be a UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(docId)) {
        console.error("[LanceDB] Invalid docId format:", docId);
        throw new Error('Invalid document ID format');
      }

      console.log("[LanceDB] Adding document to namespace:", {
        namespace,
        docId,
        hasCachedData: !!fullFilePath && !skipCache
      });

      const cacheResult = await cachedVectorInformation(fullFilePath);
      if (cacheResult.exists) {
        console.log("[LanceDB] Using cached vector data:", {
          chunksCount: cacheResult.chunks.length,
          firstChunkMetadata: cacheResult.chunks[0]?.[0]?.metadata
        });
        
        const { client } = await this.connect();
        const { chunks } = cacheResult;
        const documentVectors = [];
        const submissions = [];

        for (const chunk of chunks) {
          chunk.forEach((chunk) => {
            const id = uuidv4();
            const { id: _id, ...chunkMetadata } = chunk.metadata || {};
            documentVectors.push({ docId, vectorId: id });
            submissions.push({ 
              id, 
              vector: chunk.values,
              docId,
              text: chunkMetadata.text || '',
              title: chunkMetadata.title || 'Untitled Document',
              source: chunkMetadata.source || 'local://document',
              ...chunkMetadata
            });
          });
        }

        console.log("[LanceDB] Prepared submissions:", {
          submissionCount: submissions.length,
          documentVectorCount: documentVectors.length,
          sampleDocId: documentVectors[0]?.docId
        });

        await this.updateOrCreateCollection(client, submissions, namespace);
        await DocumentVectors.bulkInsert(documentVectors);
        return { vectorized: true, error: null };
      }

      // If we are here then we are going to embed and store a novel document.
      // We have to do this manually as opposed to using LangChains `xyz.fromDocuments`
      // because we then cannot atomically control our namespace to granularly find/remove documents
      // from vectordb.
      const EmbedderEngine = getEmbeddingEngineSelection();
      const textSplitter = new TextSplitter({
        chunkSize: TextSplitter.determineMaxChunkSize(
          await SystemSettings.getValueOrFallback({
            label: "text_splitter_chunk_size",
          }),
          EmbedderEngine?.embeddingMaxChunkLength
        ),
        chunkOverlap: await SystemSettings.getValueOrFallback(
          { label: "text_splitter_chunk_overlap" },
          20
        ),
        chunkHeaderMeta: TextSplitter.buildHeaderMeta(metadata),
      });
      const textChunks = await textSplitter.splitText(pageContent);

      console.log("Chunks created from document:", textChunks.length);
      const documentVectors = [];
      const vectors = [];
      const submissions = [];
      const vectorValues = await EmbedderEngine.embedChunks(textChunks);

      if (!!vectorValues && vectorValues.length > 0) {
        console.log("[LanceDB] Creating new vectors:", {
          vectorCount: vectorValues.length,
          chunkCount: textChunks.length
        });

        const normalizedMeta = normalizeMetadata(metadata);
        
        // Validate before processing
        if (documentVectors.length > 0) {
          console.warn("[LanceDB] Document vectors already exist before processing new vectors");
        }

        for (const [i, vector] of vectorValues.entries()) {
          const vectorRecord = {
            id: uuidv4(),
            values: vector,
            metadata: { 
              ...normalizedMeta,
              docId: documentData.docId || metadata.docId,
              text: textChunks[i],
              title: normalizedMeta.title || 'Untitled Document',
              page: i + 1,
              source: normalizedMeta.source || 'local://document'
            },
          };

          vectors.push(vectorRecord);
          documentVectors.push({ 
            docId,
            vectorId: vectorRecord.id 
          });
          submissions.push({
            id: vectorRecord.id,
            vector: vectorRecord.values,
            docId,
            text: textChunks[i] || '',
            title: normalizedMeta.title || 'Untitled Document',
            source: normalizedMeta.source || 'local://document',
            ...normalizedMeta
          });
        }

        console.log("[LanceDB] Vector creation complete:", {
          vectorsCreated: vectors.length,
          documentVectorsCreated: documentVectors.length,
          submissionsCreated: submissions.length
        });
      } else {
        throw new Error(
          "Could not embed document chunks! This document will not be recorded."
        );
      }

      if (vectors.length > 0) {
        const chunks = [];
        for (const chunk of toChunks(vectors, 500)) chunks.push(chunk);

        console.log("Inserting vectorized chunks into LanceDB collection.");
        const { client } = await this.connect();
        await this.updateOrCreateCollection(client, submissions, namespace);
        await storeVectorResult(chunks, fullFilePath);
      }

      if (documentVectors.some(dv => !dv.docId)) {
        console.error("[LanceDB] Found document vectors with missing docId:", 
          documentVectors.filter(dv => !dv.docId)
        );
        throw new Error('Some document vectors are missing docId');
      }

      console.log("[LanceDB] Successfully inserted document vectors:", {
        count: documentVectors.length,
        namespace,
        docId
      });

      await DocumentVectors.bulkInsert(documentVectors);
      return { vectorized: true, error: null };
    } catch (e) {
      console.error("addDocumentToNamespace", e.message);
      return { vectorized: false, error: e.message };
    }
  },
  performSimilaritySearch: async function ({
    namespace = null,
    input = "",
    LLMConnector = null,
    similarityThreshold = 0.25,
    topN = 4,
    filterIdentifiers = [],
  }) {
    if (!namespace || !input || !LLMConnector)
      throw new Error("Invalid request to performSimilaritySearch.");

    const { client } = await this.connect();
    if (!(await this.namespaceExists(client, namespace))) {
      return {
        contextTexts: [],
        sources: [],
        message: "Invalid query - no documents found for workspace!",
      };
    }

    const queryVector = await LLMConnector.embedTextInput(input);
    const { contextTexts, sourceDocuments } = await this.similarityResponse(
      client,
      namespace,
      queryVector,
      similarityThreshold,
      topN,
      filterIdentifiers
    );

    const sources = sourceDocuments.map((metadata, i) => {
      return { metadata: { ...metadata, text: contextTexts[i] } };
    });
    return {
      contextTexts,
      sources: this.curateSources(sources),
      message: false,
    };
  },
  "namespace-stats": async function (reqBody = {}) {
    const { namespace = null } = reqBody;
    if (!namespace) throw new Error("namespace required");
    const { client } = await this.connect();
    if (!(await this.namespaceExists(client, namespace)))
      throw new Error("Namespace by that name does not exist.");
    const stats = await this.namespace(client, namespace);
    return stats
      ? stats
      : { message: "No stats were able to be fetched from DB for namespace" };
  },
  "delete-namespace": async function (reqBody = {}) {
    const { namespace = null } = reqBody;
    if (!namespace) throw new Error("No namespace value provided");
    
    const { client } = await this.connect();
    if (!(await this.namespaceExists(client, namespace))) return;
    
    try {
      console.log(`[LanceDB] Attempting to delete namespace: ${namespace}`);
      
      // Step 1: Try API deletion first
      await this.deleteVectorsInNamespace(client, namespace);
      
      // Step 2: Physical cleanup
      const namespacePath = path.join(process.env.STORAGE_DIR || './storage', 'lancedb', `${namespace}.lance`);
      if (fs.existsSync(namespacePath)) {
        console.log(`[LanceDB] Removing namespace directory: ${namespacePath}`);
        try {
          // First try recursive deletion
          fs.rmSync(namespacePath, { recursive: true, force: true });
        } catch (fsError) {
          console.error(`[LanceDB] Failed standard directory removal, attempting manual cleanup`, {
            error: fsError.message,
            path: namespacePath
          });
          
          // If recursive deletion fails, try manual file-by-file cleanup
          const files = fs.readdirSync(namespacePath);
          for (const file of files) {
            const filePath = path.join(namespacePath, file);
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              console.warn(`[LanceDB] Could not remove file: ${filePath}`, e.message);
            }
          }
          // Try directory removal again after files are gone
          fs.rmdirSync(namespacePath);
        }
      }
      
      return {
        message: `Namespace ${namespace} was deleted successfully.`
      };
    } catch (e) {
      console.error(`[LanceDB] Failed to delete namespace`, {
        namespace,
        error: e.message,
        stack: e.stack
      });
      throw e;
    }
  },
  reset: async function () {
    const { client } = await this.connect();
    const fs = require("fs");
    fs.rm(`${client.uri}`, { recursive: true }, () => null);
    return { reset: true };
  },
  curateSources: function (sources = []) {
    const documents = [];
    for (const source of sources) {
      const { text, vector: _v, _distance: _d, ...rest } = source;
      const metadata = rest.hasOwnProperty("metadata") ? rest.metadata : rest;
      if (Object.keys(metadata).length > 0) {
        documents.push({
          ...metadata,
          ...(text ? { text } : {}),
        });
      }
    }

    return documents;
  },
  handleFileOperation: async function(error, operation = 'unknown') {
    if (error.message.includes("Unable to copy file") && 
        error.message.includes("Operation not supported (os error 95)")) {
      
      console.log(`[LanceDB] Handling SMB3 file operation for ${operation}`);
      const match = error.message.match(/Unable to copy file from (.*?) to (.*?):/);
      if (!match) {
        console.error("[LanceDB] Could not parse file paths from error message:", error.message);
        throw error;
      }
      
      const [_, fromPath, toPath] = match;
      console.log(`[LanceDB] Attempting manual file operation:
        Operation: ${operation}
        From: ${fromPath}
        To: ${toPath}
      `);
      
      try {
        // For manifest files, we need to ensure the directory exists
        const toDir = path.dirname(toPath);
        if (!fs.existsSync(toDir)) {
          fs.mkdirSync(toDir, { recursive: true });
        }
        
        const content = fs.readFileSync(fromPath);
        console.log(`[LanceDB] Read source file: ${fromPath} (${content.length} bytes)`);
        
        fs.writeFileSync(toPath, content);
        console.log(`[LanceDB] Wrote destination file: ${toPath}`);
        
        // Only delete source if it still exists
        if (fs.existsSync(fromPath)) {
          fs.unlinkSync(fromPath);
          console.log(`[LanceDB] Cleaned up temporary file: ${fromPath}`);
        }
        
        return true;
      } catch (copyError) {
        console.error(`[LanceDB] Manual file operation failed:`, {
          operation,
          error: copyError.message,
          code: copyError.code,
          fromPath,
          toPath,
          exists: {
            from: fs.existsSync(fromPath),
            to: fs.existsSync(toPath),
            toDir: fs.existsSync(path.dirname(toPath))
          }
        });
        throw copyError;
      }
    }
    throw error;
  },
  normalizeMetadata: function (metadata) {
    return {
      id: metadata.id || '',
      title: metadata.title || '',
      type: 'file',
      source: metadata.source || 'local://document',
      chunkSource: metadata.chunkSource || 'local://document',
      originalName: metadata.metadata?.originalName || '',
      uploadDate: metadata.metadata?.uploadDate || new Date().toISOString(),
      fileType: metadata.metadata?.fileType || '',
      encoding: metadata.metadata?.encoding || 'base64',
      docAuthor: metadata.metadata?.docAuthor || 'manual upload',
      description: metadata.metadata?.description || ''
    };
  },
};

module.exports.LanceDb = LanceDb;