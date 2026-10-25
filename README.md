    # SigmaOS-office

    LibreOffice icon/style integration

    Part of the **SigmaOS** sovereign operating-system ecosystem — a multi-repository
    distribution modelled on Linux Mint and Omarchy Linux. See the parent
    [`SigmaOS`](https://github.com/AaryanSinghChauhan09/SigmaOS) repository for the
    full component index.

    ## Upstream inspirations
    - https://github.com/linuxmint/libreoffice-style-mint

    ## Design principles applied
    - **Separation of Concerns**
- **Defensive Programming**
- **Fail-Fast**
- **KISS**
- **Deterministic Testing**

    ## Usage
    Verbs: `apply-plan, icons, mapping, verify`

    ```
    $ sigma-office-style mapping
.docx -> libreoffice-writer.svg
.xlsx -> libreoffice-calc.svg
$ sigma-office-style apply-plan mint
mint: .docx -> libreoffice-writer.svg
$ sigma-office-style icons mint
libreoffice-base.svg libreoffice-calc.svg ...
$ sigma-office-style verify mint --available available.txt
ok: 12/12 icons present

    ```

    ## Build & test
    ```
    make build
    make test
    ```

    ## Licence
    GNU General Public License v3.0 (FOSS).
