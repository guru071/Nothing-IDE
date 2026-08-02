/**
 * Minimal parser for Android's compiled binary XML format (AXML) - the
 * format AndroidManifest.xml is stored in inside every APK. Based on the
 * public chunk layout used by AOSP's ResourceTypes.h (RES_XML_* chunks).
 * Only implements what's needed to read manifest metadata: element/
 * attribute names+values, resolved through the string pool. No support for
 * resource-value dereferencing (attributes that reference a resource
 * table entry, e.g. "@string/app_name", are returned as that raw
 * resource id rather than the resolved string).
 */

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_XML_START_ELEMENT = 0x0102;
const CHUNK_XML_END_ELEMENT = 0x0103;

const TYPE_STRING = 3;
const TYPE_INT_BOOLEAN = 0x12;

const UTF8_FLAG = 0x100;

function readStringPool(view, chunkStart) {
	const stringCount = view.getUint32(chunkStart + 8, true);
	const flags = view.getUint32(chunkStart + 16, true);
	const stringsStart = view.getUint32(chunkStart + 20, true);
	const isUtf8 = (flags & UTF8_FLAG) !== 0;

	const offsets = [];
	for (let i = 0; i < stringCount; i++) {
		offsets.push(view.getUint32(chunkStart + 28 + i * 4, true));
	}

	const strings = offsets.map((offset) => {
		const start = chunkStart + stringsStart + offset;
		return isUtf8 ? readUtf8String(view, start) : readUtf16String(view, start);
	});

	return strings;
}

function readLen8(view, offset) {
	const first = view.getUint8(offset);
	if ((first & 0x80) === 0) return { length: first, bytesRead: 1 };
	const second = view.getUint8(offset + 1);
	return { length: ((first & 0x7f) << 8) | second, bytesRead: 2 };
}

function readLen16(view, offset) {
	const first = view.getUint16(offset, true);
	if ((first & 0x8000) === 0) return { length: first, bytesRead: 2 };
	const second = view.getUint16(offset + 2, true);
	return { length: ((first & 0x7fff) << 16) | second, bytesRead: 4 };
}

function readUtf16String(view, start) {
	const { length, bytesRead } = readLen16(view, start);
	const dataStart = start + bytesRead;
	const chars = [];
	for (let i = 0; i < length; i++) {
		chars.push(view.getUint16(dataStart + i * 2, true));
	}
	return String.fromCharCode(...chars);
}

function readUtf8String(view, start) {
	// UTF-8 pool entries encode both the UTF-16 length and the UTF-8 byte
	// length (in that order) before the actual bytes.
	const utf16Len = readLen8(view, start);
	const byteLen = readLen8(view, start + utf16Len.bytesRead);
	const dataStart = start + utf16Len.bytesRead + byteLen.bytesRead;
	const bytes = new Uint8Array(
		view.buffer,
		view.byteOffset + dataStart,
		byteLen.length,
	);
	return new TextDecoder("utf-8").decode(bytes);
}

function resolveString(strings, ref) {
	if (ref < 0 || ref >= strings.length) return null;
	return strings[ref];
}

function attributeValue(view, attrOffset, strings) {
	const rawValueRef = view.getInt32(attrOffset + 8, true);
	const dataType = view.getUint8(attrOffset + 15);
	const data = view.getUint32(attrOffset + 16, true);

	if (dataType === TYPE_STRING) {
		return resolveString(strings, rawValueRef >= 0 ? rawValueRef : data);
	}
	if (dataType === TYPE_INT_BOOLEAN) return data !== 0;
	if (rawValueRef >= 0) return resolveString(strings, rawValueRef);
	return data; // numeric/resource-reference/etc - return the raw 32-bit value
}

/**
 * Parses an AndroidManifest.xml AXML buffer into a simple element tree.
 * @param {ArrayBuffer} buffer
 * @returns {{tagName: string, attributes: Record<string, any>, children: object[]}}
 */
export function parseAxml(buffer) {
	const view = new DataView(buffer);
	let strings = [];
	const root = { tagName: "#root", attributes: {}, children: [] };
	const stack = [root];

	let offset = 8; // skip the outer chunk's own header (type+headerSize+chunkSize)
	while (offset < buffer.byteLength - 8) {
		const chunkType = view.getUint16(offset, true);
		const chunkSize = view.getUint32(offset + 4, true);
		if (chunkSize <= 0 || offset + chunkSize > buffer.byteLength) break;

		if (chunkType === CHUNK_STRING_POOL) {
			strings = readStringPool(view, offset);
		} else if (chunkType === CHUNK_XML_START_ELEMENT) {
			// ResXMLTree_node (8-byte chunk header + lineNumber + comment) is
			// 16 bytes, then ResXMLTree_attrExt starts: ns(4) name(4)
			// attributeStart(2) attributeSize(2) attributeCount(2) ...
			const attrExtStart = offset + 16;
			const nameRef = view.getInt32(attrExtStart + 4, true);
			const attributeStart = view.getUint16(attrExtStart + 8, true);
			const attributeSize = view.getUint16(attrExtStart + 10, true);
			const attrCount = view.getUint16(attrExtStart + 12, true);
			const tagName = resolveString(strings, nameRef) || "?";
			const attributes = {};

			const attrsStart = attrExtStart + attributeStart;
			for (let i = 0; i < attrCount; i++) {
				const attrOffset = attrsStart + i * attributeSize;
				const attrNameRef = view.getInt32(attrOffset + 4, true);
				const attrName = resolveString(strings, attrNameRef) || `attr${i}`;
				attributes[attrName] = attributeValue(view, attrOffset, strings);
			}

			const node = { tagName, attributes, children: [] };
			stack[stack.length - 1].children.push(node);
			stack.push(node);
		} else if (chunkType === CHUNK_XML_END_ELEMENT) {
			if (stack.length > 1) stack.pop();
		}
		// CDATA, namespace, and resource-map chunks are skipped (unused here) -
		// every chunk type is walked past via chunkSize regardless.

		offset += chunkSize;
	}

	return root.children[0] || root;
}

/**
 * Extracts the handful of fields useful for an "APK analyzer" view from a
 * parsed manifest tree.
 * @param {ReturnType<typeof parseAxml>} manifest
 */
export function summarizeManifest(manifest) {
	const attrs = manifest.attributes || {};
	const usesSdk = manifest.children.find((c) => c.tagName === "uses-sdk");
	const application = manifest.children.find(
		(c) => c.tagName === "application",
	);

	const permissions = manifest.children
		.filter(
			(c) =>
				c.tagName === "uses-permission" ||
				c.tagName === "uses-permission-sdk-23",
		)
		.map((c) => c.attributes.name)
		.filter(Boolean);

	const countTag = (tag) =>
		application?.children.filter((c) => c.tagName === tag).length || 0;

	return {
		package: attrs.package || null,
		versionName: attrs.versionName ?? null,
		versionCode: attrs.versionCode ?? null,
		minSdkVersion: usesSdk?.attributes.minSdkVersion ?? null,
		targetSdkVersion: usesSdk?.attributes.targetSdkVersion ?? null,
		permissions,
		activityCount: countTag("activity"),
		serviceCount: countTag("service"),
		receiverCount: countTag("receiver"),
		providerCount: countTag("provider"),
	};
}
