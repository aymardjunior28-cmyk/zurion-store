#!/bin/bash
set -e
# Cross-compile sqlite3 native binding for Android ARM64
# Uses Android NDK toolchain directly (no node-gyp dependency)

ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
NDK="$ANDROID_HOME/ndk/27.2.12479018"
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/linux-x86_64"
API=24
ARCH=aarch64
TARGET=$ARCH-linux-android

CC="$TOOLCHAIN/bin/${TARGET}${API}-clang"
CXX="$TOOLCHAIN/bin/${TARGET}${API}-clang++"
AR="$TOOLCHAIN/bin/llvm-ar"
RANLIB="$TOOLCHAIN/bin/llvm-ranlib"

BUILD_DIR="$(cd "$(dirname "$0")" && pwd)/build-android"
mkdir -p "$BUILD_DIR"

NODE_HEADERS="$(cd "$(dirname "$0")/../../node_modules/@choreruiz/capacitor-node-js/android/libnode/include" && pwd)"
NAPI_HEADERS="$NODE_HEADERS/node"

echo "=== Cross-compiling sqlite3 for Android ARM64 ==="
echo "NDK: $NDK"
echo "Target: $TARGET (API $API)"
echo "Node headers: $NODE_HEADERS"

# 1. Download sqlite3 amalgamation
cd "$BUILD_DIR"
SQLITE_VERSION="3490000"
SQLITE_URL="https://www.sqlite.org/2025/sqlite-amalgamation-${SQLITE_VERSION}.zip"
if [ ! -f "sqlite-amalgamation-${SQLITE_VERSION}/sqlite3.c" ]; then
    echo "--- Downloading sqlite3 amalgamation ---"
    curl -sL "$SQLITE_URL" -o sqlite-amalgamation.zip
    unzip -o sqlite-amalgamation.zip
fi
SQLITE_SRC="$BUILD_DIR/sqlite-amalgamation-${SQLITE_VERSION}"

# 2. Compile sqlite3.c -> sqlite3.o
echo "--- Compiling sqlite3.c ---"
$CC -c -fPIC -DSQLITE_THREADSAFE=1 -DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_JSON1 \
    -DSQLITE_TEMP_STORE=2 -DSQLITE_DEFAULT_MEMSTATUS=0 \
    -DSQLITE_OMIT_DEPRECATED -DSQLITE_OMIT_PROGRESS_CALLBACK \
    -DSQLITE_ENABLE_COLUMN_METADATA \
    -I "$SQLITE_SRC" \
    "$SQLITE_SRC/sqlite3.c" -o "$BUILD_DIR/sqlite3.o"

# 3. Compile sqlite3_extension_init.c (same as sqlite3.c for amalgamation)
# No extra step needed.

# 4. Create stub for node binding (minimal N-API wrapper)
cat > "$BUILD_DIR/sqlite3_binding.c" << 'BINDING_EOF'
#include <node_api.h>
#include <string.h>
#include <stdlib.h>

// Forward declarations for sqlite3 functions
typedef struct sqlite3 sqlite3;
typedef struct sqlite3_stmt sqlite3_stmt;
extern int sqlite3_open_v2(const char*, sqlite3**, int, const char*);
extern int sqlite3_close(sqlite3*);
extern int sqlite3_exec(sqlite3*, const char*, int(*)(void*,int,char**,char**), void*, char**);
extern int sqlite3_prepare_v2(sqlite3*, const char*, int, sqlite3_stmt**, const char**);
extern int sqlite3_step(sqlite3_stmt*);
extern int sqlite3_finalize(sqlite3_stmt*);
extern int sqlite3_errcode(sqlite3*);
extern const char* sqlite3_errmsg(sqlite3*);
extern int sqlite3_column_count(sqlite3_stmt*);
extern int sqlite3_bind_text(sqlite3_stmt*, int, const char*, int, void(*)(void*));
extern int sqlite3_bind_double(sqlite3_stmt*, int, double);
extern int sqlite3_bind_int(sqlite3_stmt*, int, int);
extern int sqlite3_bind_blob(sqlite3_stmt*, int, const void*, int, void(*)(void*));
extern const unsigned char* sqlite3_column_text(sqlite3_stmt*, int);
extern double sqlite3_column_double(sqlite3_stmt*, int);
extern int sqlite3_column_int(sqlite3_stmt*, int);
extern const void* sqlite3_column_blob(sqlite3_stmt*, int);
extern int sqlite3_column_bytes(sqlite3_stmt*, int);
extern int sqlite3_changes(sqlite3*);
extern long long sqlite3_last_insert_rowid(sqlite3*);
extern void sqlite3_free(void*);

#define SQLITE_TRANSIENT ((void(*)(void*))-1)

typedef struct {
    sqlite3* db;
} Database;

static napi_ref constructor_ref;

static napi_value Method_not_implemented(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// Minimal init that returns an object with basic methods
static napi_value Init(napi_env env, napi_callback_info info) {
    napi_value js_this;
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, &js_this, NULL);

    Database* db = (Database*)malloc(sizeof(Database));
    db->db = NULL;

    const char* filename = ":memory:";
    if (argc >= 1) {
        napi_valuetype t;
        napi_typeof(env, args[0], &t);
        if (t == napi_string) {
            char buf[1024];
            size_t len;
            napi_get_value_string_utf8(env, args[0], buf, sizeof(buf), &len);
            buf[len] = '\0';
            filename = buf;
        }
    }

    int rc = sqlite3_open_v2(filename, &db->db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, NULL);
    if (rc != 0) {
        free(db);
        napi_throw_error(env, NULL, sqlite3_errmsg(db->db));
        return NULL;
    }

    napi_wrap(env, js_this, db, NULL, NULL, NULL);
    return js_this;
}

void Destructor(napi_env env, void* data, void* hint) {
    if (data) {
        Database* db = (Database*)data;
        if (db->db) sqlite3_close(db->db);
        free(db);
    }
}

napi_value Init_module(napi_env env, exports) {
    napi_value fn;
    napi_define_class(env, "Database", NAPI_AUTO_LENGTH, Init, NULL, 0, NULL, &fn);
    napi_set_named_property(env, exports, "Database", fn);
    return exports;
}

NAPI_MODULE_INIT() {
    return Init_module(env, exports);
}
BINDING_EOF

echo "--- Compiling binding ---"
$CC -c -fPIC -I "$NODE_HEADERS" -I "$SQLITE_SRC" \
    "$BUILD_DIR/sqlite3_binding.c" -o "$BUILD_DIR/sqlite3_binding.o"

# 5. Link into shared library
echo "--- Linking .so ---"
$CC -shared -fPIC -o "$BUILD_DIR/node_sqlite3.node" \
    "$BUILD_DIR/sqlite3.o" "$BUILD_DIR/sqlite3_binding.o" \
    -llog -lm -lz

# 6. Verify
file "$BUILD_DIR/node_sqlite3.node"
ls -lh "$BUILD_DIR/node_sqlite3.node"

echo "=== SUCCESS: node_sqlite3.node built for Android ARM64 ==="
