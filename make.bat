@echo off

if "%1"==""       goto up
if "%1"=="up"     goto up
if "%1"=="down"   goto down
if "%1"=="clean"  goto clean
if "%1"=="fclean" goto fclean
if "%1"=="re"     goto re
if "%1"=="logs"   goto logs
if "%1"=="ps"     goto ps
if "%1"=="check"  goto check
echo Unknown command: %1
exit /b 1

:up
docker compose up --build -d
exit /b

:down
docker compose down
exit /b

:clean
docker compose down --remove-orphans
exit /b

:fclean
docker compose down -v --rmi all --remove-orphans
exit /b

:re
call %~f0 fclean
call %~f0 up
exit /b

:logs
docker compose logs -f
exit /b

:ps
docker compose ps
exit /b

:check
bash tests/TranscendenceHealthCheck.sh
exit /b
