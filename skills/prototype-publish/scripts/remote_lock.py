"""Scoped kernel locks; files are persistent identities, never occupancy markers."""
from contextlib import contextmanager
import re
import shlex
import threading


def lock_command(root, name, wait=60, idle=60):
    if not re.fullmatch(r'(catalog|publication-[a-f0-9]{32})', name):
        raise ValueError('Invalid publication lock name')
    q = shlex.quote
    # EOF, process death, or missing heartbeats closes fd 9 and releases flock.
    script = (f'set -e; exec 9>{q(root + "/.locks/" + name)}; '
              f'flock -x -w {wait} 9 || exit 75; '
              "printf 'READY\\n'; "
              f"while IFS= read -r -t {idle} line; do "
              "[ \"$line\" = PING ] || exit 0; printf 'PONG\\n'; done")
    return (f'test -f {q(root + "/.prd-managed")} && '
            f'mkdir -p {q(root + "/.locks")} && bash -c {q(script)}')


@contextmanager
def remote_lock(remote, name):
    stdin, stdout, stderr = remote.client.exec_command(
        lock_command(remote.config['remoteRoot'], name), timeout=70)
    channel = stdout.channel
    stop = threading.Event()
    failure = []
    worker = None

    def heartbeat():
        while not stop.wait(10):
            try:
                stdin.write('PING\n')
                stdin.flush()
                if stdout.readline() != 'PONG\n':
                    raise RuntimeError('发布锁连接已关闭')
            except Exception as error:
                if stop.is_set():
                    return
                failure.append(error)
                # Fence all outstanding commands before the server's idle expiry.
                remote.client.close()
                return

    try:
        if stdout.readline() != 'READY\n':
            raise RuntimeError('无法取得发布锁（等待超时或服务器缺少 bash/flock）：' +
                               stderr.read().decode('utf-8', errors='replace'))
        channel.settimeout(15)
        worker = threading.Thread(target=heartbeat, daemon=True)
        worker.start()
        yield
        if failure:
            raise RuntimeError('发布锁连接中断，需核对远程发布状态') from failure[0]
    finally:
        stop.set()
        try:
            channel.shutdown_write()
        finally:
            channel.close()
            if worker is not None:
                worker.join(timeout=16)
