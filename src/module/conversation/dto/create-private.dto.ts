import {IsMongoId, IsNotEmpty} from 'class-validator';

export class CreatePrivateConversationDto {
    @IsMongoId()
    @IsNotEmpty()
    userId!: string;
}
