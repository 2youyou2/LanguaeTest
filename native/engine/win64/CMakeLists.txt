cmake_minimum_required(VERSION 3.18)

set(APP_NAME "languaetest" CACHE STRING "Project Name")
project(${APP_NAME} CXX)
set(CC_PROJECT_DIR ${CMAKE_CURRENT_LIST_DIR})
set(CC_UI_RESOURCES)
set(CC_PROJ_SOURCES)
set(CC_COMMON_SOURCES)
set(CC_ALL_SOURCES)
include(${CC_PROJECT_DIR}/../common/CMakeLists.txt)

# icu - begin

set(ICU_ROOT "D:/workspace/dev/vcpkg/installed/x64-windows")

target_include_directories(${ENGINE_NAME} PUBLIC
    "${ICU_ROOT}/include"
)

target_link_directories(${ENGINE_NAME} PUBLIC
    "${ICU_ROOT}/lib"
    "${ICU_ROOT}/debug/lib"
)

target_link_libraries(${ENGINE_NAME} PUBLIC
    debug icuucd
    debug icuind
    debug icudtd
    optimized icuuc
    optimized icuin
    optimized icudt
)

file(GLOB ICU_DLLS
    "${ICU_ROOT}/bin/icu*.dll"
    "${ICU_ROOT}/debug/bin/icu*.dll"
)
list(APPEND WINDOWS_DLLS ${ICU_DLLS})

# icu - end

set(EXECUTABLE_NAME ${APP_NAME})

cc_windows_before_target(${EXECUTABLE_NAME})
add_executable(${EXECUTABLE_NAME}
    ${CC_ALL_SOURCES}
)
cc_windows_after_target(${EXECUTABLE_NAME})