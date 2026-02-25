@echo off
setlocal

set MAVEN_HOME=%USERPROFILE%\.m2\wrapper\apache-maven-3.9.6
set MAVEN_BIN=%MAVEN_HOME%\bin

if not exist "%MAVEN_BIN%\mvn.cmd" (
    echo ERROR: Maven not found at %MAVEN_BIN%
    echo Please check installation
    exit /b 1
)

"%MAVEN_BIN%\mvn.cmd" %*
